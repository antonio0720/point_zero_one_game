conn = psycopg2.connect(database=DB_NAME, user=DB_USER, password=DB_PASSWORD)
cursor = conn.cursor()
query = f"SELECT {CURRENT_MODEL_COLUMN} FROM {MODEL_TABLE}"
cursor.execute(query)
result = cursor.fetchone()[0]
cursor.close()
conn.close()
return result

def set_current_model(new_model):
conn = psycopg2.connect(database=DB_NAME, user=DB_USER, password=DB_PASSWORD)
cursor = conn.cursor()
query = f"UPDATE {MODEL_TABLE} SET {CURRENT_MODEL_COLUMN}=@{CURRENT_MODEL_COLUMN}, {KILL_SWITCH_COLUMN}=FALSE WHERE id=(SELECT id FROM {MODEL_TABLE} WHERE {CURRENT_DATE_COLUMN}=(SELECT MAX({CURRENT_DATE_COLUMN}) FROM {MODEL_TABLE}))"
cursor.execute(query, {'CURRENT_MODEL': new_model})
query = f"UPDATE {MODEL_TABLE} SET {KILL_SWITCH_COLUMN}=TRUE WHERE id={new_model}"
cursor.execute(query)
conn.commit()
cursor.close()
conn.close()

def check_kill_switch():
conn = psycopg2.connect(database=DB_NAME, user=DB_USER, password=DB_PASSWORD)
cursor = conn.cursor()
query = f"SELECT {KILL_SWITCH_COLUMN} FROM {MODEL_TABLE} WHERE id=(SELECT id FROM {MODEL_TABLE} WHERE {CURRENT_DATE_COLUMN}=(SELECT MAX({CURRENT_DATE_COLUMN}) FROM {MODEL_TABLE}))"
cursor.execute(query)
result = cursor.fetchone()[0]
cursor.close()
conn.close()
return bool(result)

def main():
current_model = get_current_model()

if check_kill_switch():
print("Kill Switch is ON for the current model.")
new_model = input("Enter the ID of the model to switch to: ")
set_current_model(new_model)
print(f"Switched to Model {new_model}.")
else:
print(f"Currently using Model {current_model}.")

if __name__ == "__main__":
main()
```
