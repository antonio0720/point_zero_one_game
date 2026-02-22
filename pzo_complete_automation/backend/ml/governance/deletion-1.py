from sqlalchemy import create_engine, MetaData, Table, delete
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Data(Base):
__tablename__ = 'data'
id = Column(Integer, primary_key=True)
data_type = Column(String)
data = Column(Text)
timestamp = Column(DateTime)

engine = create_engine('postgresql://username:password@localhost/dbname')
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)

def delete_data(start_timestamp, end_timestamp):
session = Session()
data_table = Table('data', meta, autoload_with=engine)
deletion = delete(data_table).where(data_table.c.timestamp >= start_timestamp, data_table.c.timestamp <= end_timestamp)
session.execute(deletion)
session.commit()
session.close()
