with Session() as session:
query = f"SELECT CURRENT_TIMESTAMP - MAX(updated_at) FROM {table_name}"
result = session.execute(query).fetchone()[0]
return int(result.total_seconds()) / 60 / 60 / 24

def delete_old_data(table_name: str, retention_days: int):
with Session() as session:
query = f"DELETE FROM {table_name} WHERE updated_at < NOW() - INTERVAL '{retention_days} days'"
session.execute(query)

def apply_retention_policy_8():
RETENTION_DAYS_POLICY_8 = 90

tables_to_check = ["ml_feature", "ml_model"]

for table in tables_to_check:
age = get_data_age(table)
if age > RETENTION_DAYS_POLICY_8:
print(f"Table {table} is older than {RETENTION_DAYS_POLICY_8} days. Deleting old data.")
delete_old_data(table, RETENTION_DAYS_POLICY_8)
else:
print(f"Table {table} is younger than {RETENTION_DAYS_POLICY_8} days. No action needed.")

if __name__ == "__main__":
apply_retention_policy_8()
```
