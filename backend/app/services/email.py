"""Outgoing email. Transport is chosen by EMAIL_TRANSPORT: "log" (development and tests) or "smtp"."""
import logging
import smtplib
from email.message import EmailMessage

from ..config import get_settings

log = logging.getLogger("strideflow.email")
outbox: list[dict] = []  # the last messages sent with the "log" transport, so tests can read links


def send(to: str, subject: str, text: str) -> None:
    s = get_settings()
    if s.email_transport == "smtp":
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = s.email_from, to, subject
        msg.set_content(text)
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as smtp:
            smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
        log.info("email sent to=%s subject=%s", to, subject)
        return
    outbox.append({"to": to, "subject": subject, "text": text})
    del outbox[:-50]
    # Development only: the message (including its link) is written to the server log instead of being sent.
    log.warning("EMAIL (log transport) to=%s subject=%s\n%s", to, subject, text)
