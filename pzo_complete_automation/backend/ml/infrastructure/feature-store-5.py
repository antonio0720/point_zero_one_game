metadata.create_all(bind=engine)

@app.route('/features/store', methods=['POST'])
def store_feature():
session = sessionmaker(bind=engine)()
feature = request.get_json()
session.add(Feature(**feature))
session.commit()
return jsonify({'status': 'success'}), 200

@app.route('/features/retrieve', methods=['GET'])
def retrieve_feature():
feature_id = int(request.args.get('id'))
session = sessionmaker(bind=engine)()
result = session.query(features).filter(features.c.id == feature_id).scalar()
if result:
return jsonify({'name': result.name, 'value': result.value}), 200
else:
return jsonify({'error': 'Feature not found'}), 404

if __name__ == '__main__':
init_db()
app.run(debug=True)
```

You will need to define a `Feature` class and import it at the beginning of the code:

```python
from sqlalchemy import Column, Integer, String

class Feature(object):
def __init__(self, id=None, name=None, value=None):
self.id = id
self.name = name
self.value = value
```
