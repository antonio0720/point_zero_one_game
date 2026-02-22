import os
import datetime
import shutil
import hashlib
from urllib.parse import urljoin

PROJECT_DIR = '/path/to/your/project'
DATASETS_DIR = os.path.join(PROJECT_DIR, 'datasets')
ARTIFACTS_DIR = os.path.join(PROJECT_DIR, 'artifacts')

def hash_file(file):
hasher = hashlib.sha256()
with open(file, 'rb') as f:
buf = f.read(8192)
while len(buf) > 0:
hasher.update(buf)
buf = f.read(8192)
return hasher.hexdigest()

def download_dataset(url, dest):
if not os.path.exists(dest):
print(f"Downloading dataset from {url}...")
import urllib.request
urllib.request.urlretrieve(url, dest)

def save_dataset(dataset, version, dest):
data_hash = hash_file(dataset)
dataset_name = f"{version}-{data_hash}.zip"
dest_path = os.path.join(dest, dataset_name)
with zipfile.ZipFile(dest_path, 'w') as z:
for root, _, files in os.walk(dataset):
for f in files:
abspath = os.path.join(root, f)
relpath = os.path.relpath(abspath, dataset).replace('\\', '/')
arcname = os.path.join(relpath, f)
z.write(abspath, arcname)
return dest_path

def load_dataset(version, artifact):
dataset_path = urljoin(artifact, f"{version}-*.zip")
datasets = [os.path.join(DATASETS_DIR, d) for d in os.listdir(DATASETS_DIR) if os.path.isdir(os.path.join(DATASETS_DIR, d))]
if not datasets:
print("No datasets found")
return None

dataset_versioned = [d for d in datasets if any([d[:len(version)] == version + '-' for version in ['v0', 'v1']])]
if len(dataset_versioned) == 0:
print("No versioned datasets found")
return None

dataset_candidates = [os.path.join(d, f) for d in dataset_versioned for f in os.listdir(d) if f.endswith('.zip')]
if len(dataset_candidates) == 0:
print("No candidate datasets found")
return None

dataset = download_dataset(dataset_candidates[0], DATASETS_DIR)
artifact_path = urljoin(artifact, os.path.basename(dataset))
shutil.copy(dataset, artifact_path)
print(f"Loaded dataset from {dataset} and saved at {artifact_path}")

def save_artifact(version, artifact):
if not os.path.exists(ARTIFACTS_DIR):
os.makedirs(ARTIFACTS_DIR)
return os.path.join(ARTIFACTS_DIR, version)

def main():
dataset = '/path/to/your/dataset'
artifact = 'https://my-artifacts-storage.com'
version = f"v{datetime.date.today().year}-{datetime.date.today().month}"
artifact_dir = save_artifact(version, artifact)
save_dataset(dataset, version, artifact_dir)

if __name__ == "__main__":
main()
