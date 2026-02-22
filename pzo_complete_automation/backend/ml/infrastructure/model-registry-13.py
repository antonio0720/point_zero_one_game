__tablename__ = 'models'
id = Column(Integer, primary_key=True)
name = Column(String(100), unique=True)
description = Column(String)
created_at = Column(String)
updated_at = Column(String)

engine = create_engine(DB_URI)
db_session = scoped_session(sessionmaker(autocommit=False, autoflush=True, bind=engine))

app = Flask(__name__)

@app.route('/models', methods=['POST'])
def add_model():
data = request.get_json()
model = Model(name=data['name'], description=data['description'])
db_session.add(model)
db_session.commit()
return jsonify({'id': model.id})

@app.route('/models/<int:id>', methods=['GET'])
def get_model(id):
model = db_session.query(Model).get(id)
if not model:
abort(404)
return jsonify({'id': model.id, 'name': model.name, 'description': model.description})

if __name__ == '__main__':
app.run(debug=True)
```
