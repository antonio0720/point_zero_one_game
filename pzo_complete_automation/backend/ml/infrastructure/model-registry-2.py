from flask import Flask, request, jsonify
from models.model_metadata import ModelMetadata

app = Flask(__name__)

models = {}

@app.route('/register', methods=['POST'])
def register():
data = request.get_json()

if not data or 'id' not in data:
return jsonify({'error': 'Invalid request'}), 400

model_id = data['id']
models[model_id] = ModelMetadata(**data)

return jsonify({'message': f"Model {model_id} registered"})

@app.route('/get/<string:model_id>', methods=['GET'])
def get_model(model_id):
if model_id not in models:
return jsonify({'error': 'Model not found'}), 404

return jsonify(models[model_id].to_dict())

if __name__ == "__main__":
app.run(host='0.0.0.0', port=5000, debug=True)
