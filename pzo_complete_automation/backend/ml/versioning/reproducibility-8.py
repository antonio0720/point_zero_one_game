import os
import datetime
import hashlib
from urllib.parse import urljoin
from typing import Dict, List, Union

class DatasetVersion:
def __init__(self, dataset_id: str, version: int, created_at: datetime.datetime):
self.dataset_id = dataset_id
self.version = version
self.created_at = created_at
self.checksum = self._calculate_checksum()

def _calculate_checksum(self) -> str:
data = f"{self.dataset_id}{self.version}{self.created_at}".encode("utf-8")
return hashlib.sha256(data).hexdigest()

class DatasetLineage:
def __init__(self, dataset_id: str):
self.dataset_id = dataset_id
self.versions: List[DatasetVersion] = []

def create_version(self, version: int) -> DatasetVersion:
now = datetime.datetime.now()
new_version = DatasetVersion(self.dataset_id, version, now)
self.versions.append(new_version)
return new_version

def get_latest_version(dataset: DatasetLineage) -> Union[DatasetVersion, None]:
if not dataset.versions:
return None
return max(dataset.versions, key=lambda v: v.created_at)

def get_checksum_for_version(dataset: DatasetLineage, version: int) -> Union[str, None]:
for vs in dataset.versions:
if vs.version == version:
return vs.checksum
return None

def check_data_integrity(dataset: DatasetLineage, checksum: str) -> bool:
latest_version = get_latest_version(dataset)
if not latest_version or latest_version.checksum != checksum:
return False
return True

def get_dataset_url(base_url: str, dataset_id: str, version: int) -> str:
return urljoin(base_url, f"{dataset_id}/v{version}")

def save_dataset(base_url: str, dataset: DatasetLineage):
for vs in dataset.versions:
dataset_url = get_dataset_url(base_url, vs.dataset_id, vs.version)
# Implement data saving logic here
