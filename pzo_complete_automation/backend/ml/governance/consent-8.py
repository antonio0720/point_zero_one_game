import os
import json
from datetime import datetime, timedelta
from uuid import uuid4

CONSENT_EXPIRATION_DAYS = 30

class ConsentManager:
def __init__(self):
self.consents = {}

def create_consent(self, user_id, data_type, consent_granted, expires_at=None):
if not expires_at:
expires_at = datetime.now() + timedelta(days=CONSENT_EXPIRATION_DAYS)
consent_id = str(uuid4())
self.consents[consent_id] = {
"user_id": user_id,
"data_type": data_type,
"consent_granted": consent_granted,
"expires_at": expires_at.strftime("%Y-%m-%d %H:%M:%S"),
}
return consent_id

def get_consent(self, consent_id):
if consent_id in self.consents:
return self.consents[consent_id]
return None

def revoke_consent(self, consent_id):
if consent_id in self.consents:
del self.consents[consent_id]

def save_consents(self, filename="consents.json"):
with open(filename, "w") as f:
json.dump(self.consents, f)

def load_consents(self, filename="consents.json"):
if os.path.exists(filename):
with open(filename, "r") as f:
self.consents = json.load(f)

def main():
cm = ConsentManager()
cm.load_consents()

consent_id = cm.create_consent("user1", "sensitive", True)
print(f"Created consent with id: {consent_id}")

saved_consents = cm.save_consents()
print(f"Saved consents to {saved_consents}")

loaded_consents = cm.load_consents()
print("Loaded consents:", json.dumps(loaded_consents, indent=2))

revoked_consent = cm.get_consent(consent_id)
cm.revoke_consent(consent_id)
print(f"Revoked consent: {json.dumps(revoked_consent, indent=2)}")

if __name__ == "__main__":
main()
