from flask import Flask, request, jsonify
from sqlalchemy import create_engine, MetaData, Table
import pandas as pd

app = Flask(__name__)

# Database connection parameters (replace with your actual values)
DB_URL = 'postgresql://username:password@localhost/database'
DB_TABLE = 'model_registry'

# Create an engine to connect to the database
engine = create_engine(DB_URL)
metadata = MetaData()
models = Table('models', metadata, autoload_with=engine)

def get_models():
results = pd.read_sql_table(DB_TABLE, con=engine)
return results.to_json(orient='records')

@app.route('/api/v1/models', methods=['GET'])
def list_models():
models_data = get_models()
return jsonify({'models': models_data})

@app.route('/api/v1/models/<string:model_id>', methods=['GET'])
def get_model(model_id):
query = models.select().where(models.c.id == model_id)
result = engine.execute(query)
return jsonify({'model': [dict(row) for row in result]})

@app.route('/api/v1/models', methods=['POST'])
def create_model():
data = request.get_json()
if 'id' not in data or 'name' not in data:
return jsonify({'error': 'Invalid input - missing "id" or "name" field.'}), 400

query = models.insert().values(**data)
engine.execute(query)
return jsonify({'message': 'Model created successfully.'})

if __name__ == '__main__':
app.run()
