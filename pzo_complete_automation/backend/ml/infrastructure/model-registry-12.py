from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import create_engine
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://username:password@localhost/db_name'
db = SQLAlchemy(app)

class Model(db.Model):
id = db.Column(db.Integer, primary_key=True)
name = db.Column(db.String(100), nullable=False)
version = db.Column(db.Integer, nullable=False)
created_at = db.Column(db.DateTime, default=datetime.utcnow)

@app.route('/models', methods=['POST'])
def add_model():
data = request.get_json()
model = Model(name=data['name'], version=data['version'])
db.session.add(model)
db.session.commit()
return jsonify({'message': 'Model added successfully.'}), 201

@app.route('/models', methods=['GET'])
def get_models():
models = Model.query.all()
output = []
for model in models:
output.append({
'id': model.id,
'name': model.name,
'version': model.version,
'created_at': model.created_at.strftime('%Y-%m-%d %H:%M:%S')
})
return jsonify(output)

if __name__ == "__main__":
app.run(debug=True)
