data = request.get_json()
db_session.execute(f"INSERT INTO features (entity_id, version, name, value) VALUES ({entity_id}, {version}, '{name}', {data['value']})")
db_session.commit()
return jsonify({'success': True}), 200

@app.route('/get/<entity_id>/<version>/<name>', methods=['GET'])
def get_feature(entity_id, version, name):
result = db_session.execute(f"SELECT value FROM features WHERE entity_id = {entity_id} AND version = {version} AND name = '{name}'").first()
if not result:
return jsonify({'error': 'Feature not found.'}), 404
return jsonify({'value': result[0]}), 200

if __name__ == "__main__":
app.run(debug=True)
```
