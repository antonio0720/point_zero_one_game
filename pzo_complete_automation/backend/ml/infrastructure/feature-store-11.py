__tablename__ = 'features'

def __init__(self, group_name, feature_name=None):
self.group_name = group_name
self.feature_name = feature_name

def save(self, timestamp, value):
engine = create_engine('postgresql://username:password@host:port/dbname')
conn = engine.connect()
features_table.insert().values(
group_name=self.group_name,
feature_name=self.feature_name if self.feature_name else self.group_name,
timestamp=timestamp,
value=value
).execute(conn)
conn.close()

@staticmethod
def get_latest(group_name, feature_name):
engine = create_engine('postgresql://username:password@host:port/dbname')
result = engine.connect().executetext(
f"SELECT value FROM features WHERE group_name='{group_name}' AND feature_name='{feature_name}' ORDER BY timestamp DESC LIMIT 1"
).fetchone()
if result:
return result[0]
return None
```

Don't forget to replace `'postgresql://username:password@host:port/dbname'` with your actual PostgreSQL connection string. You may also want to implement additional methods for getting historical values, handling missing data, etc., depending on your specific requirements.
