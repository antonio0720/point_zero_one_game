from flask import Flask, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, DateTime
import os
import time

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///models.db'
db = SQLAlchemy(app)

class ModelInfo(db.Model):
id = Column(Integer, primary_key=True)
model_name = Column(String(100), nullable=False)
created_at = Column(DateTime, default=time.time)

def __repr__(self):
return f'<ModelInfo {self.model_name}>'

def register_model(model_name):
new_model = ModelInfo(model_name=model_name)
db.session.add(new_model)
db.session.commit()

@app.route('/register', methods=['POST'])
def register():
if not request.json or not 'model' in request.json:
return {'error': 'Invalid request'}, 400
model_name = request.json['model']
register_model(model_name)
return {'success': True}

if __name__ == '__main__':
db.create_all()
app.run(debug=True)
