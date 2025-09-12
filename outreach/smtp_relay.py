# smtp_relay.py
from fastapi import FastAPI, Request, HTTPException
import smtplib
import ssl
from email.mime.text import MIMEText
import os

app = FastAPI()

SMTP_HOST = os.getenv("SMTP_HOST")       # e.g. "mail.yourdomain.com"
SMTP_PORT = 465
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
SECRET_KEY = os.getenv("SECRET_KEY")     # shared secret for auth

@app.post("/send")
async def send_mail(request: Request):
    #Auth check
    if request.headers.get("x-api-key") != SECRET_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    data = await request.json()
    to_addr = data.get("to")
    subject = data.get("subject", "")
    body = data.get("body", "")

    if not to_addr:
        raise HTTPException(status_code=400, detail="Missing 'to' address")

    # Build email
    msg = MIMEText(body, "plain")
    msg["Subject"] = subject
    msg["From"] = SMTP_USER
    msg["To"] = to_addr

    # Send via your real SMTP server
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as server:
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, [to_addr], msg.as_string())

    return {"status": "ok", "to": to_addr}

