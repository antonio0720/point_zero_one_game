from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import scoped_session, sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class MLDataset(Base):
__tablename__ = 'ml_datasets'
id = Column(Integer, primary_key=True)
name = Column(String)
version = Column(Integer)
created_at = Column(DateTime, default=datetime.utcnow)

class MLLineage(Base):
__tablename__ = 'ml_lineages'
id = Column(Integer, primary_key=True)
dataset_id = Column(Integer, ForeignKey('ml_datasets.id'))
parent_dataset_id = Column(Integer, ForeignKey('ml_datasets.id'))
operation = Column(String)
created_at = Column(DateTime, default=datetime.utcnow)

engine = create_engine('sqlite:///ml_audit_trail.db')
db_session = scoped_session(sessionmaker(bind=engine))
Base.metadata.create_all(engine)

def version_ml_dataset(name, version):
dataset = MLDataset(name=name, version=version)
db_session.add(dataset)
db_session.commit()
return dataset.id

def create_lineage(parent_dataset_id, operation, child_dataset_id=None):
if child_dataset_id is None:
child_dataset_id = version_ml_dataset('new_version', parent_dataset.version + 1)

lineage = MLLineage(parent_dataset_id=parent_dataset_id, dataset_id=child_dataset_id, operation=operation)
db_session.add(lineage)
db_session.commit()

def get_lineage(dataset_id):
return db_session.query(MLLineage).filter_by(dataset_id=dataset_id).all()
