from flask import Flask, request, jsonify
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score

app = Flask(__name__)

# Sample data (replace with real data)
data = [
{"id": 1, "feature": 0.6, "label": 1},
{"id": 2, "feature": 0.8, "label": 1},
{"id": 3, "feature": 0.4, "label": 0},
{"id": 4, "feature": 0.7, "label": 1},
{"id": 5, "feature": 0.2, "label": 0},
]

X = [d["feature"] for d in data]
y = [d["label"] for d in data]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

model = LogisticRegression()
model.fit(X_train, y_train)

def predict(features):
return model.predict([features])[0]

def update_model(data):
global X, y

X += [d["feature"] for d in data]
y += [d["label"] for d in data]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
model.fit(X_train, y_train)

@app.route('/predict', methods=['POST'])
def predict_endpoint():
data = request.get_json()
prediction = predict(data["feature"])
accuracy = accuracy_score(y_test, model.predict(X_test))
return jsonify({"prediction": prediction, "accuracy": accuracy})

@app.route('/update', methods=['POST'])
def update_endpoint():
data = request.get_json()
update_model(data)
return jsonify({"status": "success"})

if __name__ == '__main__':
app.run(debug=True)
