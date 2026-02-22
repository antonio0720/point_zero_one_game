conn = None
try:
conn = sqlite3.connect(db_file)
except Error as e:
print(e)

return conn

# Create table for storing dataset metadata and lineage information
def create_table(conn):
sql_create_datasets_table = """CREATE TABLE IF NOT EXISTS datasets (
id INTEGER PRIMARY KEY,
name TEXT,
version TEXT,
dataset_url TEXT,
created_on DATETIME DEFAULT CURRENT_TIMESTAMP,
modified_on DATETIME,
description TEXT);"""

try:
c = conn.cursor()
c.execute(sql_create_datasets_table)
except Error as e:
print(e)

# Add a new dataset to the database with lineage information (parent_id)
def add_dataset(conn, name, version, dataset_url, parent_id=None, description=''):
sql = '''INSERT INTO datasets(name, version, dataset_url, modified_on, description) VALUES(?, ?, ?, ?, ?);'''

c = conn.cursor()
cur_date = datetime.datetime.now()
try:
c.execute(sql, (name, version, dataset_url, cur_date, description))
conn.commit()

if parent_id is not None:
update_parent_modified_on(conn, parent_id)

except Error as e:
print(e)

# Update the modified_on field of a dataset in the database with lineage information (child_id)
def update_parent_modified_on(conn, child_id):
c = conn.cursor()
sql = 'UPDATE datasets SET modified_on = (SELECT modified_on FROM datasets WHERE id = ? LIMIT 1)'
try:
c.execute(sql, (child_id,))
conn.commit()
except Error as e:
print(e)

# Function to get the URL of a dataset by its ID from the database
def get_dataset_url(conn, id):
sql = 'SELECT dataset_url FROM datasets WHERE id = ?'
c = conn.cursor()
try:
c.execute(sql, (id,))
result = c.fetchone()[0]
except Error as e:
print(e)
return result

# Function to list all datasets with lineage information
def list_datasets(conn):
sql = 'SELECT * FROM datasets'
c = conn.cursor()
try:
c.execute(sql)
rows = c.fetchall()
for row in rows:
print(row)
except Error as e:
print(e)
```

Save this code into a file named `provenance-1.py`. To use the script, create an SQLite database file (for example, `datasets.db`) and call the `create_connection()` function to connect to it:

```python
conn = create_connection('datasets.db')
create_table(conn)
```

After that, you can add new datasets to the database using the `add_dataset()` function:

```python
add_dataset(conn, 'example_dataset', 'v1.0', 'http://example-dataset-url')
add_dataset(conn, 'child_dataset', 'v1.1', 'http://child-dataset-url', 1) # Parent ID is the ID of the example_dataset
```

To list all datasets with lineage information, call the `list_datasets()` function:

```python
list_datasets(conn)
```
