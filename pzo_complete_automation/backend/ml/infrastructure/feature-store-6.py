In this code, replace `'postgresql://user:password@localhost/db_name'`, `username`, `password`, and `redis_host` with your PostgreSQL database credentials and Redis host details accordingly. Also, ensure you have the necessary packages installed (Flask, Flask-SQLAlchemy, Flask-Caching, SQLAlchemy, psycopg2, and redis).

To set up the database and tables:

1. Run `python create_tables.py` to create the table using the following code:

```python
from sqlalchemy import create_engine, Table, MetaData

metadata = MetaData()
features = Table('features', metadata,
Column('feature_id', Integer, primary_key=True),
Column('name', String),
Column('value', NumericType),
)

engine = create_engine(os.environ['SQLALCHEMY_DATABASE_URI'])
metadata.create_all(engine)
