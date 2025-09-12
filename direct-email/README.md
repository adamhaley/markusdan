# SMTP Relay (FastAPI)

Tiny HTTP → SMTP relay for when your host blocks SMTP ports (e.g. DigitalOcean).  
Deploy on EC2, call via HTTP, forwards to your real SMTP server (465).

## Install
sudo apt update && sudo apt install -y python3-venv git
sudo mkdir -p /opt/smtp_relay && cd /opt/smtp_relay
# copy smtp_relay.py + requirements.txt here
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

## Run
uvicorn smtp_relay:app --host 0.0.0.0 --port 80

## Example
curl -X POST http://<EC2-IP>/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: supersecret" \
  -d '{"to":"test@example.com","subject":"Hi","body":"It works"}'

## systemd (optional)
/etc/systemd/system/smtp_relay.service:

[Service]
ExecStart=/opt/smtp_relay/venv/bin/uvicorn smtp_relay:app --host 0.0.0.0 --port 80
WorkingDirectory=/opt/smtp_relay
Restart=always
Environment="SMTP_HOST=mail.domain.com"
Environment="SMTP_USER=user@domain.com"
Environment="SMTP_PASS=pass"
Environment="SECRET_KEY=supersecret"

Enable/start:
sudo systemctl daemon-reload && sudo systemctl enable smtp_relay && sudo systemctl start smtp_relay

## Notes
- Restrict port 80 to your n8n server’s IP
- Use strong SECRET_KEY
- Add HTTPS via Nginx/Certbot if needed

