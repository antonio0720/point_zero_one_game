import pandas as pd
from sqlalchemy import create_engine, event
from datetime import datetime, timedelta

# Connection to the database
db_url = "postgresql://user:password@host:port/dbname"
engine = create_engine(db_url)

def setup_retention():
# Create retention table if not exists
connection = engine.connect()
metadata = sqlalchemy.MetaData()
retention_table = sqlalchemy.Table('data_retention', metadata,
Column('id', Integer, primary_key=True),
Column('model_name', String),
Column('created_at', DateTime),
Column('last_updated', DateTime))
metadata.create_all(connection)

def record_data(model_name):
connection = engine.connect()
query = f"INSERT INTO data_retention (model_name, created_at, last_updated) VALUES ({model_name}, {datetime.utcnow()}, {datetime.utcnow()}) ON CONFLICT DO NOTHING"
connection.execute(query)

def check_data_age(threshold=timedelta(days=30)):
connection = engine.connect()
query = "SELECT * FROM data_retention WHERE created_at < (NOW() - :threshold)"
df = pd.read_sql_query(query, connection, params={'threshold': threshold})
return df

def delete_old_data():
df = check_data_age()
if not df.empty:
df['model_name'].to_list()  # Extract model names for deletion
connection = engine.connect()
for model in df['model_name']:
query = f"DELETE FROM data_retention WHERE model_name = {model}"
connection.execute(query)

# Call the functions to set up retention, record data, and check for old data
setup_retention()
record_data('my-ml-model')
delete_old_data()
