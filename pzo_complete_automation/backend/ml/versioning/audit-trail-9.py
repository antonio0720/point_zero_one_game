from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import scoped_session, sessionmaker
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Dataset(Base):
__tablename__ = 'datasets'
id = Column(Integer, primary_key=True)
name = Column(String(100), nullable=False)
version = Column(Integer, nullable=False)
created_at = Column(DateTime, nullable=False)

class DatasetLineage(Base):
__tablename__ = 'dataset_lineage'
id = Column(Integer, primary_key=True)
dataset_id = Column(Integer, ForeignKey('datasets.id'), nullable=False)
source_dataset_id = Column(Integer, ForeignKey('datasets.id'))
modified_at = Column(DateTime, nullable=False)

def init_db():
engine = create_engine('sqlite:///ml_audit_trail.db')
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
return scoped_session(SessionLocal())

def get_dataset(id):
db = init_db()
dataset = db.query(Dataset).filter_by(id=id).first()
db.close()
return dataset

def create_dataset(name, version):
db = init_db()
dataset = Dataset(name=name, version=version, created_at=datetime.utcnow())
db.add(dataset)
db.commit()
db.close()
return dataset

def update_dataset(id, version):
db = init_db()
dataset = get_dataset(id)
if not dataset:
raise Exception("Dataset not found")

dataset.version = version
db.commit()
db.close()

def create_lineage(source_dataset_id, modified_at):
db = init_db()
lineage = DatasetLineage(source_dataset_id=source_dataset_id, modified_at=modified_at)
db.add(lineage)
db.commit()
db.close()

def get_lineage(id):
db = init_db()
lineage = db.query(DatasetLineage).filter_by(id=id).first()
db.close()
return lineage
