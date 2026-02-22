import pandas as pd
from sqlalchemy import create_engine

def setup_db(database_uri):
engine = create_engine(database_uri)
return engine

def get_data(table_name, engine):
df = pd.read_sql_table(table_name, con=engine)
return df

def apply_retention_policy(df, retention_days=7):
current_date = pd.to_datetime(pd.Timestamp.now()).date()
df = df[df['created_at'] > (current_date - pd.Timedelta(days=retention_days))]
return df

def save_data(df, table_name, engine):
df.to_sql(table_name, con=engine, if_exists='replace', index=False)

if __name__ == "__main__":
# Connect to the database
database_uri = "postgresql://username:password@localhost/database"
engine = setup_db(database_uri)

# Get data from a table
table_name = "ml_data"
df = get_data(table_name, engine)

# Apply retention policy (7 days)
df = apply_retention_policy(df)

# Save the updated data to the database
save_data(df, table_name, engine)
