query = text(f"SELECT created_at FROM {table.name} ORDER BY created_at ASC LIMIT 1")
result = engine.connect().execute(query)
oldest_date = result.first()[0] if result else None
return oldest_date

def delete_data_older_than(delete_date):
query = text(f"DELETE FROM {table.name} WHERE created_at < '{delete_date}'")
engine.execute(query)

# Run retention policy every day at a specific time (e.g., 2 AM)
current_time = datetime.now()
next_run_time = current_time.replace(hour=2, minute=0, second=0)
retention_threshold = next_run_time - timedelta(days=RETENTION_DAYS)
oldest_data = get_oldest_data()

if oldest_data and (oldest_data < retention_threshold):
delete_data_older_than(oldest_data.strftime("%Y-%m-%d %H:%M:%S"))

engine.dispose()
```
