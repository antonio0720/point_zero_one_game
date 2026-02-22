from flask import Flask, request, jsonify
import joblib
import numpy as np

app = Flask(__name__)

model = joblib.load('choice_drill_ml_model.pkl')

def predict(user_input):
data = np.array([user_input])
predictions = model.predict(data)
return predictions[0]

@app.route('/generate', methods=['POST'])
def generate():
user_input = request.json['user_input']
result = predict(user_input)
return jsonify({'result': result})

if __name__ == '__main__':
app.run(debug=True)
