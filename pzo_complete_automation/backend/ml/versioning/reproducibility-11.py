import os
import sqlite3
from typing import Dict, Any
import git
import yaml

# Database structure (table creation)
def create_db():
conn = sqlite3.connect("reproducibility.db")
c = conn.cursor()
c.execute('''CREATE TABLE IF NOT EXISTS datasets
(id INTEGER PRIMARY KEY, name TEXT UNIQUE, version TEXT, commit_hash TEXT)''')
conn.commit()
conn.close()

# Database insertion for a dataset with Git information
def insert_dataset(name: str, version: str, commit_hash: str):
conn = sqlite3.connect("reproducibility.db")
c = conn.cursor()
c.execute('''INSERT INTO datasets (name, version, commit_hash) VALUES (?, ?, ?)''', (name, version, commit_hash))
conn.commit()
conn.close()

# Get Git hash for the current branch
def get_current_commit():
repo = git.Repo(search_parent_directories=True)
branch = repo.active_branch
return branch.commit.hexsha

# Fetch all datasets metadata from SQLite and print them as dictionaries
def fetch_datasets():
conn = sqlite3.connect("reproducibility.db")
c = conn.cursor()
c.execute('''SELECT * FROM datasets''')
rows = c.fetchall()
datasets: Dict[str, Any] = {}

for row in rows:
dataset_name, dataset_version, dataset_commit_hash = row
datasets[dataset_name] = {
"version": dataset_version,
"commit_hash": dataset_commit_hash
}

return datasets

# Load a yaml file containing metadata for a dataset
def load_metadata(filename: str) -> Dict[str, Any]:
with open(filename) as f:
return yaml.safe_load(f)

if __name__ == "__main__":
create_db()

# Load metadata for datasets in the project directory
datasets_metadata = {}
for root, dirs, files in os.walk('dataset'):
if not root.endswith("/my_dataset"):
continue

versioned_datasets = [f for f in files if f.endswith(".json")]
for versioned_dataset in versioned_datasets:
dataset_path = os.path.join(root, versioned_dataset)
dataset_name = os.path.basename(os.path.dirname(dataset_path))
dataset_version = os.path.basename(dataset_path).replace(".json", "")
datasets_metadata[dataset_name] = load_metadata(dataset_path)

# Insert dataset information into the database, including Git commit hashes
for dataset_name, metadata in datasets_metadata.items():
dataset_commit_hash = get_current_commit()
print(f"Inserting dataset {dataset_name} with version {metadata['version']} and commit hash {dataset_commit_hash}")
insert_dataset(dataset_name, metadata["version"], dataset_commit_hash)

# Fetch all datasets from the database and print them as dictionaries
fetched_datasets = fetch_datasets()
print("\nDatasets in the database:")
for name, dataset in fetched_datasets.items():
print(f"{name}: {dataset}")
