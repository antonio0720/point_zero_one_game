cur = conn.cursor()
query = f"""
DELETE FROM ml_models WHERE name = %s;
DELETE FROM model_artifacts WHERE model_name = %s AND timestamp <= %s;
"""
cur.execute(query, (model_name, model_name, timestamp))
conn.commit()

def main():
connection = psycopg2.connect(
host="your_host",
database="your_database",
user="your_user",
password="your_password"
)

model_name = "some_model"
timestamp = 1634508800  # Unix timestamp for the deletion point

delete_data(connection, model_name, timestamp)

if __name__ == "__main__":
main()
```
