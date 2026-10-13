"""Donation payments.

PAYMENTS_MODE=sandbox (default): no money moves. The donor sees the same flow, and the payment is confirmed or
cancelled by a simulator, so the whole pipeline (donation → income → public totals) can be demonstrated.

PAYMENTS_MODE=mpesa: real Safaricom Daraja STK push. Safaricom calls back to /api/payments/mpesa/callback/<token>;
the unguessable token in the URL is checked, and the donation is only confirmed when ResultCode is 0 and the
amount matches what was requested.
"""
import base64
from datetime import datetime

import httpx

from ..config import get_settings

DARAJA = {"sandbox": "https://sandbox.safaricom.co.ke", "production": "https://api.safaricom.co.ke"}


def normalise_msisdn(phone: str) -> str | None:
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("0") and len(digits) == 10:
        digits = "254" + digits[1:]
    elif digits.startswith("7") or digits.startswith("1"):
        digits = "254" + digits if len(digits) == 9 else digits
    return digits if digits.startswith("254") and len(digits) == 12 else None


def start_payment(method: str, phone: str | None, amount: float, reference: str) -> dict:
    s = get_settings()
    if s.payments_mode != "mpesa" or method != "mpesa":
        return {"mode": "sandbox", "provider_ref": f"SIM-{reference}",
                "instructions": "Sandbox payment: no money will move. Use the buttons to complete or cancel it."}
    msisdn = normalise_msisdn(phone or "")
    if not msisdn:
        raise ValueError("Enter a Safaricom number like 0712 345 678.")
    base = DARAJA[s.mpesa_env]
    key = base64.b64encode(f"{s.mpesa_consumer_key}:{s.mpesa_consumer_secret}".encode()).decode()
    with httpx.Client(timeout=15) as c:
        tok = c.get(f"{base}/oauth/v1/generate?grant_type=client_credentials", headers={"Authorization": f"Basic {key}"}).json()["access_token"]
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        pwd = base64.b64encode(f"{s.mpesa_shortcode}{s.mpesa_passkey}{ts}".encode()).decode()
        r = c.post(f"{base}/mpesa/stkpush/v1/processrequest", headers={"Authorization": f"Bearer {tok}"}, json={
            "BusinessShortCode": s.mpesa_shortcode, "Password": pwd, "Timestamp": ts, "TransactionType": "CustomerPayBillOnline",
            "Amount": int(round(amount)), "PartyA": msisdn, "PartyB": s.mpesa_shortcode, "PhoneNumber": msisdn,
            "CallBackURL": s.mpesa_callback_url, "AccountReference": reference[:12], "TransactionDesc": "Donation"}).json()
    if r.get("ResponseCode") != "0":
        raise ValueError("M-Pesa could not start the payment. Try again.")
    return {"mode": "mpesa", "provider_ref": r["CheckoutRequestID"], "instructions": "Check your phone and enter your M-Pesa PIN to complete the donation."}


def parse_mpesa_callback(payload: dict) -> dict:
    cb = payload.get("Body", {}).get("stkCallback", {})
    items = {i.get("Name"): i.get("Value") for i in cb.get("CallbackMetadata", {}).get("Item", [])}
    return {"checkout_id": cb.get("CheckoutRequestID"), "ok": cb.get("ResultCode") == 0,
            "amount": items.get("Amount"), "receipt": items.get("MpesaReceiptNumber")}
