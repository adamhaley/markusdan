#!/usr/bin/env python3
"""
FAQ Email Response Daemon

Monitors an IMAP inbox for webinar questions and automatically generates
responses using RAG (Retrieval Augmented Generation) with a Supabase vector store.
"""

import asyncio
import email
import logging
import re
import signal
import smtplib
import ssl
import sys
import time
from dataclasses import dataclass
from email.header import decode_header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import httpx
from imapclient import IMAPClient
from openai import OpenAI

from config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


@dataclass
class ParsedEmail:
    """Parsed email data"""
    thread_id: str
    reply_to: str
    firstname: str
    lastname: str
    fullname: str
    questions: list[str]
    raw_text: str


class FAQEmailDaemon:
    """Main daemon class for processing FAQ emails"""

    def __init__(self):
        self.openai = OpenAI(api_key=settings.openai_api_key)
        self.http_client = httpx.Client(timeout=30.0)
        self.running = True
        self._email_template: Optional[str] = None

    def parse_email(self, msg: email.message.Message, msg_uid: int) -> Optional[ParsedEmail]:
        """Parse an email message and extract questions"""
        # Get email body
        text = ""
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        text = payload.decode("utf-8", errors="replace")
                        break
                elif content_type == "text/html" and not text:
                    payload = part.get_payload(decode=True)
                    if payload:
                        text = payload.decode("utf-8", errors="replace")
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                text = payload.decode("utf-8", errors="replace")

        if not text:
            logger.warning(f"No text content found in email {msg_uid}")
            return None

        # Extract name fields (match until end of line)
        first_match = re.search(r"Vorname:\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
        last_match = re.search(r"Nachname:\s*(.+?)(?:\n|$)", text, re.IGNORECASE)

        firstname = first_match.group(1).strip() if first_match else ""
        lastname = last_match.group(1).strip() if last_match else ""

        # Clean up lastname if it contains "Email" or is empty-ish
        if not lastname or "Email" in lastname or "E-Mail" in lastname:
            lastname = ""

        fullname = f"{firstname} {lastname}".strip() if lastname else firstname

        # Extract reply-to email
        reply_to = None
        email_match = re.search(r"E-Mail:\s*([^\s<]+@[^\s<]+)", text, re.IGNORECASE)
        if email_match:
            reply_to = email_match.group(1).strip().lower()
            reply_to = re.sub(r"[.,;]+$", "", reply_to)

        if not reply_to:
            logger.warning(f"No reply-to email found in message {msg_uid}")
            return None

        # Extract questions from Chat section
        chat_section = text.split("Chat:")[-1] if "Chat:" in text else ""
        questions = []

        # Pattern: "1: Name (timestamp): question text"
        pattern = r"\d+:\s.*?\):\s([\s\S]*?)(?=\n\d+:|$)"
        matches = re.finditer(pattern, chat_section)

        for match in matches:
            q = match.group(1).strip()
            q = re.sub(r"\s+", " ", q)  # Normalize whitespace

            # Stop at footer phrases
            if re.search(r"Vielen Dank|Best regards|Webinaris|Hinweis:|Note:", q, re.IGNORECASE):
                break

            if q and not re.search(r"Vielen Dank|Best regards|Webinaris|Hinweis:|Note:", q, re.IGNORECASE):
                questions.append(q)

        if not questions:
            logger.warning(f"No questions found in message {msg_uid}")
            return None

        return ParsedEmail(
            thread_id=str(msg_uid),
            reply_to=reply_to,
            firstname=firstname,
            lastname=lastname,
            fullname=fullname,
            questions=questions,
            raw_text=text,
        )

    def generate_embedding(self, text: str) -> list[float]:
        """Generate embedding for text using OpenAI"""
        response = self.openai.embeddings.create(
            model="text-embedding-3-small",
            input=text,
        )
        return response.data[0].embedding

    def query_faqs(self, embedding: list[float], match_count: int = 5) -> list[dict]:
        """Query Supabase for matching FAQs"""
        response = self.http_client.post(
            settings.supabase_rpc_url,
            headers={
                "Authorization": f"Bearer {settings.supabase_service_key}",
                "apikey": settings.supabase_service_key,
                "Content-Type": "application/json",
            },
            json={
                "query_embedding": embedding,
                "match_count": match_count,
            },
        )
        response.raise_for_status()
        return response.json()

    def generate_answer(self, question: str, faq_matches: list[dict], is_last: bool = False) -> str:
        """Generate an answer using GPT based on FAQ matches"""

        extra_instruction = ""
        if is_last:
            extra_instruction = (
                "- Answer in a few sentences, and answer in a way that elicits curiosity "
                "from the user to take the next step and schedule an appointment. Build curiosity "
                "and anticipation within the answer so the participant is on edge to hear more "
                "and talk about it in person."
            )

        system_prompt = f"""You are a helpful support assistant for the Deutsches Edelsteinhaus FAQ system.
A user has submitted a question in German.
You have access to the following relevant FAQ Answers retrieved from the database, ordered by most similar first:

FAQ Matches:
{faq_matches}

Instructions:
- Always answer in **German** unless explicitly asked for English.
- Use the retrieved FAQ answers as your only source of truth.
- You may rephrase, clarify, or combine them for a natural reply.
- Do not invent facts beyond what is provided.
- If the FAQ answers are incomplete, politely acknowledge and keep the answer conservative.
- Keep a professional but warm tone suitable for email replies to potential investors.
{extra_instruction}
- Format your answer as a segment of an email body with no greeting or closing signature."""

        response = self.openai.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ],
        )
        return response.choices[0].message.content

    def generate_greeting(self, fullname: str) -> str:
        """Generate a formal German greeting using GPT"""
        prompt = f"""You are an expert email salutation generator. Your role is to take an incoming name, determine if it is male or female, and generate a formal greeting in German to be placed at the top of an email. You will only generate the greeting, nothing else. No punctuation necessary.

Examples:
"Sehr geehrter Herr Foth"
"Sehr geehrte Frau Foth"

The incoming name is: {fullname}"""

        response = self.openai.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content.strip()

    def load_email_template(self) -> str:
        """Load email template from Supabase"""
        if self._email_template:
            return self._email_template

        response = self.http_client.get(
            f"{settings.supabase_rest_url}/email_templates",
            headers={
                "Authorization": f"Bearer {settings.supabase_service_key}",
                "apikey": settings.supabase_service_key,
            },
            params={"id": "eq.1", "select": "body"},
        )
        response.raise_for_status()
        data = response.json()

        if data:
            self._email_template = data[0]["body"]
            return self._email_template

        # Fallback template
        return """{{greeting}},

vielen Dank für Ihre Fragen während unseres Webinars.

{{questions}}

Mit freundlichen Grüßen,
Deutsches Edelsteinhaus Team"""

    def send_email(self, to: str, subject: str, body: str):
        """Send email via SMTP"""
        msg = MIMEMultipart("alternative")
        msg["From"] = settings.smtp_user
        msg["To"] = to
        msg["Subject"] = subject

        # Attach HTML body
        msg.attach(MIMEText(body, "html", "utf-8"))

        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context) as server:
            server.login(settings.smtp_user, settings.smtp_pass)
            server.send_message(msg)

        logger.info(f"Email sent to {to}")

    def process_email(self, msg: email.message.Message, msg_uid: int):
        """Process a single email through the full pipeline"""
        logger.info(f"Processing email {msg_uid}")

        # Parse email
        parsed = self.parse_email(msg, msg_uid)
        if not parsed:
            return

        logger.info(f"Found {len(parsed.questions)} question(s) from {parsed.reply_to}")

        # Process each question
        qa_pairs = []
        for i, question in enumerate(parsed.questions):
            is_last = i == len(parsed.questions) - 1
            logger.info(f"Processing question {i + 1}: {question[:50]}...")

            # Generate embedding
            embedding = self.generate_embedding(question)

            # Query FAQs
            faq_matches = self.query_faqs(embedding)
            logger.info(f"Found {len(faq_matches)} FAQ matches")

            # Generate answer
            answer = self.generate_answer(question, faq_matches, is_last=is_last)

            qa_pairs.append((question, answer))

        # Format Q&A pairs as HTML
        qa_html = "\n\n".join(
            f'<p><strong>Ihre Frage: "{q}"</strong><br>{a}</p>'
            for q, a in qa_pairs
        )

        # Generate greeting
        greeting = self.generate_greeting(parsed.fullname) if parsed.fullname else "Sehr geehrte Damen und Herren"

        # Load template and replace placeholders
        template = self.load_email_template()
        email_body = template.replace("{{greeting}}", greeting).replace("{{questions}}", qa_html)

        # Send email
        subject = f"Deutsches Edelsteinhaus Sachwerte - {parsed.fullname}, Ihre Webinarfrage"
        self.send_email(parsed.reply_to, subject, email_body)

        logger.info(f"Successfully processed email {msg_uid}")

    def run(self):
        """Main daemon loop using IMAP IDLE"""
        logger.info("Starting FAQ Email Daemon")
        logger.info(f"Connecting to {settings.imap_host}:{settings.imap_port}")

        while self.running:
            try:
                with IMAPClient(settings.imap_host, port=settings.imap_port, ssl=True) as client:
                    client.login(settings.imap_user, settings.imap_pass)
                    client.select_folder("INBOX")
                    logger.info("Connected to IMAP server")

                    while self.running:
                        # Check for unseen messages
                        unseen = client.search(["UNSEEN"])

                        for uid in unseen:
                            try:
                                # Fetch the message
                                messages = client.fetch([uid], ["RFC822"])
                                raw_email = messages[uid][b"RFC822"]
                                msg = email.message_from_bytes(raw_email)

                                # Process it
                                self.process_email(msg, uid)

                                # Mark as seen
                                client.add_flags([uid], ["\\Seen"])

                            except Exception as e:
                                logger.error(f"Error processing message {uid}: {e}", exc_info=True)

                        # Use IDLE to wait for new messages
                        logger.debug("Entering IDLE mode")
                        client.idle()

                        # Wait for up to 5 minutes, then refresh
                        responses = client.idle_check(timeout=300)
                        client.idle_done()

                        if responses:
                            logger.info(f"IDLE received: {responses}")

            except Exception as e:
                logger.error(f"Connection error: {e}", exc_info=True)
                if self.running:
                    logger.info("Reconnecting in 30 seconds...")
                    time.sleep(30)

    def shutdown(self, signum, frame):
        """Handle shutdown signals"""
        logger.info("Shutdown signal received")
        self.running = False


def main():
    daemon = FAQEmailDaemon()

    # Handle shutdown signals
    signal.signal(signal.SIGINT, daemon.shutdown)
    signal.signal(signal.SIGTERM, daemon.shutdown)

    daemon.run()


if __name__ == "__main__":
    main()
