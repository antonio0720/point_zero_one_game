conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()

cursor.execute('''CREATE TABLE IF NOT EXISTS datasets (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE);''')
cursor.execute('''CREATE TABLE IF NOT EXISTS dataset_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, dataset_id INTEGER, version INT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(dataset_id) REFERENCES datasets(id));''')
cursor.execute('''CREATE TABLE IF NOT EXISTS data_modifications (id INTEGER PRIMARY KEY AUTOINCREMENT, version_id INTEGER, modification TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(version_id) REFERENCES dataset_versions(id));''')

conn.commit()
conn.close()

def create_dataset(name: str):
conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()
cursor.execute("INSERT INTO datasets (name) VALUES (?)", (name,))
dataset_id = cursor.lastrowid
conn.commit()
conn.close()
return dataset_id

def get_dataset_versions(dataset_id: int) -> List[Dict[str, Any]]:
conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()
cursor.execute("SELECT * FROM dataset_versions WHERE dataset_id = ? ORDER BY version", (dataset_id,))
rows = cursor.fetchall()
versions = [{"id": row[0], "dataset_id": row[1], "version": row[2], "created_at": row[3].strftime("%Y-%m-%d %H:%M:%S")} for row in rows]
conn.close()
return versions

def add_version(dataset_id: int, version: int):
conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()
cursor.execute("INSERT INTO dataset_versions (dataset_id, version) VALUES (?, ?)", (dataset_id, version))
conn.commit()
conn.close()

def add_data_modification(version_id: int, modification: str):
conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()
cursor.execute("INSERT INTO data_modifications (version_id, modification) VALUES (?, ?)", (version_id, modification))
conn.commit()
conn.close()

def get_data_provenance(version_id: int) -> Dict[str, Any]:
conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()
cursor.execute("SELECT dataset_versions.*, data_modifications.* FROM dataset_versions JOIN data_modifications ON dataset_versions.id = data_modifications.version_id WHERE dataset_versions.id = ? ORDER BY data_modifications.created_at", (version_id,))
rows = cursor.fetchall()
provenance = {
"dataset": {"id": rows[0][1], "name": get_dataset_by_id(rows[0][1])},
"versions": [{"id": row[0], "dataset_id": row[1], "version": row[2], "created_at": row[3].strftime("%Y-%m-%d %H:%M:%S")} for row in rows],
"modifications": [{"id": row[4], "version_id": row[0], "modification": row[5], "created_at": row[6].strftime("%Y-%m-%d %H:%M:%S")} for row in rows]
}
conn.close()
return provenance

def get_dataset_by_id(dataset_id: int) -> str:
conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()
cursor.execute("SELECT name FROM datasets WHERE id = ?", (dataset_id,))
name = cursor.fetchone()[0]
conn.close()
return name
```
