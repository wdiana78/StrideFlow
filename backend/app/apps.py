"""App catalogue and industries (the Odoo model): each organization installs only the apps it needs.

The catalogue lives in platform.json so the web preview uses exactly the same definitions.
"""
import json
from pathlib import Path

_P = json.loads((Path(__file__).parent / "platform.json").read_text())
APPS = _P["apps"]
APP_KEYS = {a["key"] for a in APPS}
INDUSTRIES = _P["industries"]
INDUSTRY_BY_KEY = {i["key"]: i for i in INDUSTRIES}
PALETTES = _P["palettes"]
EVENT_FORM_FIELDS = _P["event_form_fields"]
