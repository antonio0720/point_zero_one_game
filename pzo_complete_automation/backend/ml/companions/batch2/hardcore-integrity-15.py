import hmac
import hashlib
from typing import Dict, Any, bytes

def hardcore_integrity_check(secret: bytes, message: str) -> bool:
secret_hash = hashlib.sha256(secret).digest()
message_bytes = message.encode('utf-8')
hmac_key = hmac.new(secret_hash, message_bytes, hashlib.sha256).digest()
return hmac.compare_digest(hmac_key, message_hash)
