dataset = datasets.insert().values(name=name, created_at=datetime.utcnow()).execute()
return dataset.inserted_primary_key[0]

def get_latest_version(dataset_id):
result = db_session.query(versions).filter_by(dataset_id=dataset_id).order_by(versions.c.created_at.desc()).first()
return result.version if result else None

def create_version(dataset_id, version, description):
version = versions.insert().values(dataset_id=dataset_id, version=version, created_at=datetime.utcnow(), description=description).execute()
return version.inserted_primary_key[0]
```
