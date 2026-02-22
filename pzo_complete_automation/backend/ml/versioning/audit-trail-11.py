from sqlalchemy import create_engine, Column, Integer, String, ForeignKey
from sqlalchemy.orm import declarative_base
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.sql import func

Base = declarative_base()

class Dataset(Base):
__tablename__ = 'datasets'
id = Column(Integer, primary_key=True)
name = Column(String)
version = Column(Integer)
created_at = Column(String(30), default=func.now())
updated_at = Column(String(30), onupdate=func.now())

class DatasetVersion(Base):
__tablename__ = 'dataset_versions'
id = Column(Integer, primary_key=True)
dataset_id = Column(Integer, ForeignKey('datasets.id'))
version = Column(Integer, primary_key=True)
data_url = Column(String)
description = Column(String)
created_at = Column(String(30), default=func.now())
updated_at = Column(String(30), onupdate=func.now())

class DataLineage(Base):
__tablename__ = 'data_lineage'
id = Column(Integer, primary_key=True)
version_from_id = Column(Integer, ForeignKey('dataset_versions.id'))
version_to_id = Column(Integer, ForeignKey('dataset_versions.id'))
created_at = Column(String(30), default=func.now())

engine = create_engine('sqlite:///datasets.db')
Base.metadata.create_all(engine)
