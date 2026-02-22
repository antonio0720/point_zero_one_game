```python
from flask import Flask, request, jsonify
import joblib

app = Flask(__name__)
model = joblib.load('rivalry_ledger_6.pkl')

@app.route('/predict', methods=['POST'])
def predict():
data = request.get_json()
prediction = model.predict([data])[0]
return jsonify({'prediction': prediction})

if __name__ == '__main__':
app.run(debug=True)
```

This code creates a Flask web application with a single endpoint `/predict`. When the API receives a POST request at that endpoint, it expects JSON data as an input to predict the outcome of a match based on the Rivalry Ledger model (trained and saved in 'rivalry_ledger_6.pkl'). The result is returned as a JSON response with the prediction.
