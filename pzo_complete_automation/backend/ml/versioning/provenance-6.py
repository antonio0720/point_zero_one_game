import os
import sys
import subprocess
import hashlib
import git
import json
from pathlib import Path

def commit_data(repo, filepath, message):
repo.git.add(filepath)
repo.git.commit(message)

def calculate_md5(filepath):
hasher = hashlib.md5()
with open(filepath, "rb") as f:
buf = f.read()
hasher.update(buf)
return hasher.hexdigest()

def get_data_lineage(base_dir):
lineage = {}
for root, _, files in os.walk(base_dir):
filepath = Path(root).relative_to(base_dir)
md5 = calculate_md5(os.path.join(root, files[0]))
if files[0] in lineage:
lineage[files[0]]["parents"].append((filepath, md5))
else:
lineage[files[0]] = {"md5": md5, "parents": [(filepath, md5)]}
return lineage

def main():
if len(sys.argv) != 2:
print("Usage: python provenance-6.py <base_directory>")
sys.exit(1)

base_dir = Path(sys.argv[1])
if not base_dir.is_dir():
print(f"Error: '{sys.argv[1]}' is not a valid directory.")
sys.exit(1)

repo = git.Repo.init(base_dir)

lineage = get_data_lineage(base_dir)
for data_file, metadata in lineage.items():
md5 = metadata["md5"]
commit_msg = f"Adding initial version of {data_file} with MD5 {md5}"
print(commit_msg)
commit_data(repo, os.path.join(base_dir, data_file), commit_msg)

print("Data versions and lineage committed successfully.")

if __name__ == "__main__":
main()
