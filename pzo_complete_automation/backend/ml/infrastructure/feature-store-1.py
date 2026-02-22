with engine.connect() as connection:
result = connection.execute(features.select().where(features.c.name == feature_name)).fetchone()
if result:
return jsonify({'value': result[2]})
else:
return jsonify({'error': 'Feature not found'}), 404

@app.route('/feature', methods=['POST'])
def store_feature():
data = request.get_json()
feature_name = data['name']
feature_value = data['value']

with engine.connect() as connection:
connection.execute(features.insert().values(name=feature_name, value=feature_value))

return jsonify({'success': True})

if __name__ == '__main__':
app.run(port=5001, debug=True)
```

This code creates a Flask API with two endpoints: one to get a feature by name (GET /feature/<string:feature_name>) and another to store a feature (POST /feature). The features are stored in a SQLite database named `feature_store.db`.
