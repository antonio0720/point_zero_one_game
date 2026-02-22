import os
import sys
import hashlib
from typing import List

def compute_hashes(files: List[str]) -> dict:
hashes = {}
for file in files:
with open(file, 'rb') as f:
content = f.read()
hashes[file] = hashlib.sha256(content).hexdigest()
return hashes

def main():
if len(sys.argv) < 3:
print("Usage: python hardcore-integrity-13.py [path_to_directory] [reference_hash_file]")
sys.exit(1)

directory = sys.argv[1]
reference_hashes_file = sys.argv[2]

if not os.path.exists(directory):
print(f"{directory} does not exist.")
sys.exit(1)

files = [os.path.join(directory, f) for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f))]

file_hashes = compute_hashes(files)
with open(reference_hashes_file, 'r') as f:
reference_hashes = [line.strip() for line in f.readlines()]

mismatch_found = False
for ref_hash, file_hash in zip(reference_hashes, file_hashes.values()):
if ref_hash != file_hash:
print(f"Mismatched hash for file {os.path.join(directory, next(filter(lambda f: hashlib.sha256(f.encode('utf-8')).hexdigest() == ref_hash, files)))}. Expected {ref_hash}, but got {file_hash}.")
mismatch_found = True

if not mismatch_found:
print("No mismatched hashes found.")

if __name__ == "__main__":
main()
