import os
from sqlalchemy import create_engine, MetaData, Table
from sqlalchemy.orm import sessionmaker

# Database connection details
DB_URI = 'postgresql://username:password@localhost/database'

# Define the table to be deleted
table_name = 'your_ml_data_table'

engine = create_engine(DB_URI)
metadata = MetaData()

# Reflect the tables from the database into the metadata object
metadata.reflect(bind=engine)

# Create a new table object for the specified table
target_table = Table(table_name, metadata)

with sessionmaker(bind=engine) as session:
# Query the data to be deleted
records_to_delete = session.query(target_table).all()

# Iterate over the records and delete them
for record in records_to_delete:
session.delete(record)

# Commit the changes and close the session
session.commit()
