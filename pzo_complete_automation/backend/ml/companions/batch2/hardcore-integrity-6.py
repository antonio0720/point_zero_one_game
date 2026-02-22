import hashlib
from typing import List

def hardcore_integrity(data: List[bytes], salt: bytes) -> str:
assert len(data) > 0, "Data list must contain at least one element"
assert isinstance(salt, bytes), "Salt must be a bytes object"

hashed_data = [hashlib.sha256((x + salt).encode()).hexdigest() for x in data]
combined_hashes = ''.join(sorted(hashed_data))
return hashlib.sha256(combined_hashes.encode()).hexdigest()
