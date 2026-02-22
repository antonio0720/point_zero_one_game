from flask import Flask, request, jsonify
import pickle
import numpy as np

app = Flask(__name__)
model = pickle.load(open('rivalry_ledger_v4.pkl', 'rb'))

@app.route('/predict', methods=['POST'])
def predict():
data = request.get_json()
inputs = np.array([data['team1'], data['team2']]).reshape(1, -1)
prediction = model.predict(inputs)[0]
return jsonify({'winner': prediction})

if __name__ == '__main__':
app.run(debug=True)
