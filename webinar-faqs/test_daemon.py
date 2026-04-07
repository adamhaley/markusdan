#!/usr/bin/env python3
"""
Dry-run test for the FAQ Email Daemon using sample Webinaris email.
"""

from email_daemon import FAQEmailDaemon, ParsedEmail
import email
from email.mime.text import MIMEText

# Sample Webinaris email from n8n workflow pinned data
SAMPLE_EMAIL_TEXT = """Nachfolgend findest du die Chatnachrichten, die
tatjana.haufler@deutsches-edelsteinhaus.com im Webinar "Brevo Webinar: Die
größten Gefahren für Ihr Vermögen" hinterlassen hat.

Vorname: Tatjana
Nachname:
E-Mail: tatjana.haufler@deutsches-edelsteinhaus.com
Telefonnummer:
Rückruf-Bitte: Nein
Rückruf-Nummer:
Notiz:
Source ID:
Affiliate ID:
UTM Source:
UTM Medium:
UTM Campaign:
UTM Term:
UTM Content:
Webinar: Brevo Webinar: Die größten Gefahren für Ihr Vermögen (BREVO YOUTUBE:
DEH - Auto WEBIGG NOT ACTIVE (x))
Anmeldezeit: 09.10.2025 10:53
Webinarzeit: 09.10.2025 10:55
Geklickte Buttons:
Beantwortete Umfragen:
Login-Zeit: 09.10.2025 10:57
Logout-Zeit: 09.10.2025 12:25
Chat:
1: Tatjana (09.10.2025 10:58): sind es bei 15k mehrere steine oder istves ein stein in passender Grösse?.
2: Tatjana (09.10.2025 10:58): es ist also sinnvoll sein Haus schnekk zu verkaufen? rotz sinkender Preise
3: Tatjana (09.10.2025 10:59): Ich habe vor, nächstes Jahr nach Mauritius auszuwandern. Inwieweit ist mein Schweizer Eurokonto YUH für kleinere Vermögen noch lukrativ?
4: Tatjana (09.10.2025 10:59): Vielen Dank im Voraus für Ihre Antworten



Viele Grüße,

Webinaris (09.10.2025 12:45)

Hinweis: Alle Zeiten sind in der Zeitzone UTC+2 angegeben."""


def main():
    print("=" * 60)
    print("FAQ Email Daemon - Dry Run Test")
    print("=" * 60)

    # Create daemon instance
    daemon = FAQEmailDaemon()

    # Create a mock email message
    msg = MIMEText(SAMPLE_EMAIL_TEXT, "plain", "utf-8")
    msg["From"] = "Webinaris <noreply@webinaris.co>"
    msg["To"] = "test@example.com"
    msg["Subject"] = "[Webinar Benachrichtigung] Chat-Nachrichten"

    # Parse the email
    print("\n[1] Parsing email...")
    parsed = daemon.parse_email(msg, 999)

    if not parsed:
        print("ERROR: Failed to parse email")
        return

    print(f"    Reply-to: {parsed.reply_to}")
    print(f"    Name: {parsed.fullname}")
    print(f"    Questions: {len(parsed.questions)}")
    for i, q in enumerate(parsed.questions, 1):
        print(f"      {i}. {q[:60]}...")

    # Process questions (limit to first 2 for testing)
    print("\n[2] Processing questions (first 2 only for speed)...")
    qa_pairs = []

    for i, question in enumerate(parsed.questions[:2]):
        print(f"\n    --- Question {i + 1} ---")
        print(f"    Q: {question[:50]}...")

        # Generate embedding
        print("    Generating embedding...")
        embedding = daemon.generate_embedding(question)
        print(f"    ✓ Embedding: {len(embedding)} dimensions")

        # Query FAQs
        print("    Querying Supabase...")
        faq_matches = daemon.query_faqs(embedding, match_count=3)
        print(f"    ✓ Found {len(faq_matches)} FAQ matches")
        if faq_matches:
            print(f"      Top match: {faq_matches[0].get('question', 'N/A')[:50]}...")

        # Generate answer
        print("    Generating GPT answer...")
        answer = daemon.generate_answer(question, faq_matches, is_last=(i == 1))
        print(f"    ✓ Answer: {answer[:100]}...")

        qa_pairs.append((question, answer))

    # Generate greeting
    print("\n[3] Generating greeting...")
    greeting = daemon.generate_greeting(parsed.fullname)
    print(f"    ✓ Greeting: {greeting}")

    # Load template
    print("\n[4] Loading email template...")
    template = daemon.load_email_template()
    print(f"    ✓ Template loaded: {len(template)} chars")

    # Assemble email
    print("\n[5] Assembling final email...")
    qa_html = "\n\n".join(
        f'<p><strong>Ihre Frage: "{q}"</strong><br>{a}</p>'
        for q, a in qa_pairs
    )
    email_body = template.replace("{{greeting}}", greeting).replace("{{questions}}", qa_html)

    print("\n" + "=" * 60)
    print("FINAL EMAIL PREVIEW (truncated)")
    print("=" * 60)
    print(f"To: {parsed.reply_to}")
    print(f"Subject: Deutsches Edelsteinhaus Sachwerte - {parsed.fullname}, Ihre Webinarfrage")
    print("-" * 60)
    print(email_body[:1500] + "..." if len(email_body) > 1500 else email_body)
    print("=" * 60)
    print("\n✓ Dry run complete! (No email was actually sent)")


if __name__ == "__main__":
    main()
