conn = sqlite3.connect('models.db')
cursor = conn.cursor()
cursor.execute('''CREATE TABLE IF NOT EXISTS models (id INTEGER PRIMARY KEY, name TEXT, version REAL)''')
return conn

def save_model(model, name, version):
conn = init_db()
cursor = conn.cursor()
cursor.execute("INSERT OR IGNORE INTO models (name, version) VALUES (?, ?)", (name, version))
with open(f'models/{name}.pkl', 'wb') as f:
joblib.dump(model, f)
conn.commit()
conn.close()

def load_model(name, version):
conn = init_db()
cursor = conn.cursor()
cursor.execute("SELECT * FROM models WHERE name=? AND version=?", (name, version))
row = cursor.fetchone()
if not row:
return None

with open(f'models/{name}.pkl', 'rb') as f:
model = joblib.load(f)
conn.close()
return model

def rollback_to(name, version):
conn = init_db()
cursor = conn.cursor()
cursor.execute("UPDATE models SET active=False WHERE name=?", (name,))
cursor.execute("SELECT * FROM models WHERE name=? ORDER BY version DESC LIMIT 1 OFFSET 1", (name,))
row = cursor.fetchone()
if not row:
return None
model_name, model_version = row[0], row[1]
save_model(load_model(model_name, model_version), name, version)
cursor.execute("UPDATE models SET active=True WHERE name=?", (name,))
conn.commit()
conn.close()

def kill_switch():
conn = init_db()
cursor = conn.cursor()
cursor.execute("UPDATE models SET active=False")
conn.commit()
conn.close()

@app.route('/predict', methods=['POST'])
def predict():
data = request.get_json()
name = 'default'  # Model name to load if the kill switch is activated
version = 1.0      # Default model version to load if the kill switch is activated

conn = init_db()
cursor = conn.cursor()
cursor.execute("SELECT * FROM models WHERE active=True LIMIT 1")
row = cursor.fetchone()
if not row:
model = None
else:
model_name, model_version = row[0], row[1]
model = load_model(model_name, model_version)

if model is None or kill_switch():  # If no active model or the kill switch is activated
model = load_model(name, version)

if model:
predictions = model.predict(data)
return {'predictions': predictions}
else:
return {'error': 'No active model available'}

if __name__ == "__main__":
app.run()
```

This example creates an SQLite database to store the current active machine learning models and their versions. The `rollback_to` function allows you to roll back to a specific version of a model, while the `kill_switch` function deactivates all models, forcing the system to use a default one. The `predict` route uses the currently active model (or a default one if no active model exists or the kill switch is activated) to make predictions based on incoming requests.
