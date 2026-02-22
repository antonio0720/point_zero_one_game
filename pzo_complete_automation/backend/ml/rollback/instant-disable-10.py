from flask import Blueprint, request, jsonify
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

model_disable = Blueprint('model_disable', __name__)

DB_URI = 'postgresql://user:password@localhost/dbname'
engine = create_engine(DB_URI)
Session = sessionmaker(bind=engine)

def disable_model(model_id):
with Session() as session:
model = session.query(Model).filter(Model.id == model_id).first()
if model:
model.active = False
session.commit()
return True
else:
return False

@model_disable.route('/', methods=['POST'])
def disable():
data = request.get_json()
model_id = data.get('model_id')
if model_id:
result = disable_model(model_id)
if result:
return jsonify({'status': 'success', 'message': 'Model disabled.'})
else:
return jsonify({'status': 'error', 'message': 'Model not found.'})
else:
return jsonify({'status': 'error', 'message': 'Missing model_id parameter.'})
