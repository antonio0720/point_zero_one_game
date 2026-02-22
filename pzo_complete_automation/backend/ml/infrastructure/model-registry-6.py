__tablename__ = 'models'
id = Column(Integer, primary_key=True)
name = Column(String)
version = Column(String)
file_path = Column(String)
created_at = Column(DateTime)

Base.metadata.create_all(db)

@app.route('/register', methods=['POST'])
def register_model():
model_name = request.form['name']
model_version = request.form['version']
model_file = request.files['file']

model_path = os.path.join('models', f'{model_name}_{model_version}.joblib')
model_file.save(model_path)

db_model = Model(name=model_name, version=model_version, file_path=model_path, created_at=datetime.utcnow())
db.session.add(db_model)
db.session.commit()

return jsonify({'status': 'success', 'message': f'Model {model_name} version {model_version} registered.'})

@app.route('/load/<string:model_name>/<string:model_version>', methods=['GET'])
def load_model(model_name, model_version):
model = db.session.query(Model).filter_by(name=model_name, version=model_version).first()
if not model:
return jsonify({'status': 'error', 'message': f'Model {model_name} version {model_version} not found.'})

model_path = model.file_path
model = joblib.load(model_path)

return jsonify({'status': 'success', 'data': model})

if __name__ == '__main__':
app.run()
```

This code creates a Flask web service with two routes:

1. `/register` accepts a new model to be registered in the database, saving its file and metadata.
2. `/load/<model_name>/<model_version>` retrieves the specified saved model from the filesystem and returns it as JSON.
