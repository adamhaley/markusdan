FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY config.py .
COPY email_daemon.py .

# Run daemon
CMD ["python", "-u", "email_daemon.py"]
