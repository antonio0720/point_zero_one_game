conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute('''CREATE TABLE IF NOT EXISTS models (id INTEGER PRIMARY KEY, name TEXT, version REAL, description TEXT)''')
conn.commit()
conn.close()

@app.route('/models', methods=['POST'])
def add_model():
if not request.json or not 'name' in request.json:
return jsonify({"error": "Missing parameters"}), 400

name = request.json['name']
version = request.json.get('version', None)
description = request.json.get('description', '')

conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("INSERT INTO models (name, version, description) VALUES (?, ?, ?)", (name, version, description))
conn.commit()
conn.close()

return jsonify({"message": "Model added successfully"}), 201

if __name__ == '__main__':
init_db()
app.run(debug=True)
```

This code creates a Flask application with an endpoint for adding models to the registry (`/models`). The models are stored in an SQLite database, and the table schema consists of id, name, version, and description columns. The `init_db()` function initializes the database if it doesn't exist yet.
