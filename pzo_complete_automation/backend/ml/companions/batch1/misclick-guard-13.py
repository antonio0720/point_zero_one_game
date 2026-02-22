from flask import Flask, request, jsonify
import joblib
import numpy as np

app = Flask(__name__)
model = joblib.load('misclick_guard_13.joblib')

@app.route('/predict', methods=['POST'])
def predict():
data = request.get_json()
input_array = np.array([data['feature_1'], data['feature_2']])
prediction = model.predict(input_array)
return jsonify({'prediction': int(prediction[0])})

if __name__ == '__main__':
app.run()
