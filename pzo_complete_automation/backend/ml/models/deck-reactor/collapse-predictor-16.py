from flask import Flask, request, jsonify
from sklearn.linear_model import LogisticRegression
import joblib
import pandas as pd

app = Flask(__name__)
model = None

def load_model():
global model
if model is None:
model = joblib.load('collapse_predictor_16.joblib')

@app.route('/predict', methods=['POST'])
def predict():
load_model()
data = request.get_json()
X = pd.DataFrame([data]).T
prediction = model.predict(X)
return jsonify({'prediction': str(prediction[0])})

if __name__ == '__main__':
app.run(debug=True)
