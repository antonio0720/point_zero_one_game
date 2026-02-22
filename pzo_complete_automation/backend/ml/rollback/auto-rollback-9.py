__tablename__ = 'models'

id = Column(Integer, primary_key=True)
name = Column(String)
version = Column(String)
created_at = Column(DateTime, default=time.time)
kill_switch = Column(Boolean, default=False)

Base.metadata.create_all(engine)

def get_model(name, version):
session = Session()
model = session.query(Model).filter_by(name=name, version=version).first()
return model

@app.route('/deploy', methods=['POST'])
def deploy():
data = request.get_json()
name = data.get('name')
version = data.get('version')
new_model = Model(name=name, version=version)
session.add(new_model)
session.commit()
return jsonify({'status': 'success', 'id': new_model.id}), 201

@app.route('/rollback/<int:model_id>', methods=['POST'])
def rollback(model_id):
session = Session()
model = session.query(Model).filter_by(id=model_id).first()
if not model:
return jsonify({'status': 'error', 'message': 'Model not found'}), 404

# Assuming that the rollback process is implemented elsewhere
# Replace this comment with your custom code for rolling back to the given model.

model.kill_switch = True
session.commit()
return jsonify({'status': 'success'})

@app.route('/activate/<int:model_id>', methods=['POST'])
def activate(model_id):
session = Session()
model = session.query(Model).filter_by(id=model_id).first()
if not model:
return jsonify({'status': 'error', 'message': 'Model not found'}), 404

model.kill_switch = False
session.commit()
return jsonify({'status': 'success'})

if __name__ == '__main__':
app.run(debug=True)
```

This script creates a simple API for deploying, rolling back, and activating machine learning models in a SQLite database with a kill switch functionality. The API can be accessed at `localhost:5000`.
