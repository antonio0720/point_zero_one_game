__tablename__ = 'data_assets'

id = Column(Integer, primary_key=True)
name = Column(String)
version = Column(Integer)
metadata = Column(String)

class Dataflow(Base):
__tablename__ = 'dataflows'

id = Column(Integer, primary_key=True)
data_asset_id = Column(Integer, ForeignKey('data_assets.id'))
input_dataflow_id = Column(Integer, ForeignKey('dataflows.id'))
output_dataflow_id = Column(Integer, ForeignKey('dataflows.id'))
action = Column(String)
timestamp = Column(String)

def initialize_db():
engine = create_engine('postgresql://username:password@localhost/dbname')
Base.metadata.create_all(engine)

def get_dataflow_by_id(id):
engine = create_engine('postgresql://username:password@localhost/dbname')
session = engine.connect()
dataflow = session.query(Dataflow).filter_by(id=id).first()
session.close()
return dataflow

def get_dataflows():
engine = create_engine('postgresql://username:password@localhost/dbname')
session = engine.connect()
dataflows = session.query(Dataflow).all()
session.close()
return dataflows

def add_dataasset(name, version, metadata):
engine = create_engine('postgresql://username:password@localhost/dbname')
session = engine.connect()
new_dataasset = DataAsset(name=name, version=version, metadata=metadata)
session.add(new_dataasset)
session.commit()
session.close()

def add_dataflow(data_asset_id, input_dataflow_id=None, output_dataflow_id=None, action='', timestamp=''):
engine = create_engine('postgresql://username:password@localhost/dbname')
session = engine.connect()
new_dataflow = Dataflow(data_asset_id=data_asset_id, input_dataflow_id=input_dataflow_id, output_dataflow_id=output_dataflow_id, action=action, timestamp=timestamp)
session.add(new_dataflow)
session.commit()
session.close()
```

This script defines four classes: `DataAsset`, `Dataflow`, and their corresponding database tables in a PostgreSQL database. There are also functions to initialize the database, get dataflows and data assets by ID, and add new data assets and dataflows.
