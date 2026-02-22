import sqlite3
import uuid

def connect_to_database(db_path):
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
return conn, cursor

def delete_data(conn, table_name, condition):
cursor = conn.cursor()
query = f"DELETE FROM {table_name} WHERE {condition};"
cursor.execute(query)
conn.commit()

def delete_record_by_id(conn, table_name, id):
delete_data(conn, table_name, f"id={id}")

def main():
db_path = "ml_database.db"
conn, cursor = connect_to_database(db_path)

table_name = "my_table"
id_to_delete = uuid.uuid4()
delete_record_by_id(conn, table_name, str(id_to_delete))

if __name__ == "__main__":
main()
