__tablename__ = 'datasets'
id = Column(Integer, primary_key=True)
name = Column(String)
version = Column(Integer)
lineage_id = Column(Integer, ForeignKey('lineages.id'))

class Lineage(Base):
__tablename__ = 'lineages'
id = Column(Integer, primary_key=True)
name = Column(String)

def init_db():
engine = create_engine('sqlite:///datasets.db', extension=ZopeTransactionExtension())
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
return scoped_session(Session())

def add_dataset(session, name, version, lineage_name):
lineage = session.query(Lineage).filter_by(name=lineage_name).first()
if not lineage:
lineage = Lineage(name=lineage_name)
session.add(lineage)
session.commit()

dataset = Dataset(name=name, version=version, lineage_id=lineage.id)
session.add(dataset)
session.commit()
```

This script creates two tables `datasets` and `lineages`, where each dataset is associated with a specific lineage (representing its origin or parent datasets). You can use the `add_dataset` function to add new datasets to the database, ensuring proper versioning and lineage tracking.

To run the script, you'll need to execute it in an environment where SQLAlchemy is installed. After that, you can interact with the database using the `init_db`, `Session`, and `add_dataset` functions as needed.
