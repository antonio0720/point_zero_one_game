import os
import json
from datetime import datetime, timedelta
from uuid import uuid4

class ConsentManager:
def __init__(self):
self.consents = {}
self.consent_expiry = timedelta(days=30)

def create_consent(self, user_id, data_type, is_active=True):
consent_id = str(uuid4())
consent_data = {
'user_id': user_id,
'data_type': data_type,
'status': is_active,
'created_at': datetime.now(),
'expires_at': datetime.now() + self.consent_expiry
}
self.consents[consent_id] = consent_data
return consent_id

def update_consent(self, consent_id, data_type=None, status=None):
if consent_id not in self.consents:
return None
if data_type:
self.consents[consent_id]['data_type'] = data_type
if status:
self.consents[consent_id]['status'] = status
self.consents[consent_id]['updated_at'] = datetime.now()
return consent_id

def delete_consent(self, consent_id):
if consent_id not in self.consents:
return None
del self.consents[consent_id]
return consent_id

def check_consent(self, user_id, data_type):
for consent_id, consent_data in self.consents.items():
if consent_data['user_id'] == user_id and consent_data['data_type'] == data_type:
return consent_data
return None

def save_to_file(self, file_path):
with open(file_path, 'w') as f:
json.dump(self.consents, f)

@staticmethod
def load_from_file(file_path):
if not os.path.exists(file_path):
return {}
with open(file_path, 'r') as f:
data = json.load(f)
return data
