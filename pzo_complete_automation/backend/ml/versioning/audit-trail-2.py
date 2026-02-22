from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine
from datetime import datetime

Base = declarative_base()

class Dataset(Base):
__tablename__ = 'datasets'

id = Column(Integer, primary_key=True)
name = Column(String)
created_at = Column(DateTime, default=datetime.utcnow)
updated_at = Column(DateTime, onupdate=datetime.utcnow)

class Version(Base):
__tablename__ = 'versions'

id = Column(Integer, primary_key=True)
dataset_id = Column(Integer, ForeignKey('datasets.id'))
version = Column(String)
created_at = Column(DateTime, default=datetime.utcnow)
updated_at = Column(DateTime, onupdate=datetime.utcnow)
description = Column(String)

dataset = relationship("Dataset")

class AuditTrail(Base):
__tablename__ = 'audit_trails'

id = Column(Integer, primary_key=True)
version_id = Column(Integer, ForeignKey('versions.id'))
action = Column(String)
user = Column(String)
created_at = Column(DateTime, default=datetime.utcnow)

version = relationship("Version")

def create_tables(engine):
Base.metadata.create_all(engine)

engine = create_engine('postgresql://username:password@localhost/dbname')
create_tables(engine)
