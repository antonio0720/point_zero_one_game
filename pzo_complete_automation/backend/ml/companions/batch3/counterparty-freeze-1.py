from flask import Flask, request, jsonify
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import pandas as pd
import joblib

app = Flask(__name__)

model = None

def load_model():
global model
model = joblib.load('models/counterparty_freeze.joblib')

def preprocess_data(df):
# Perform any necessary preprocessing here (e.g., feature scaling, one-hot encoding)
return df

@app.route('/predict', methods=['POST'])
def predict():
global model
load_model()

data = request.get_json(force=True)
df = pd.DataFrame.from_records([data])
df = preprocess_data(df)

prediction = model.predict(df)

return jsonify({'prediction': prediction[0]})

def train():
data = pd.read_csv('data/counterparty_freeze.csv')
X, y = data.iloc[:, :-1], data.iloc[:, -1]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

accuracy = accuracy_score(y_test, model.predict(X_test))
print(f'Training Accuracy: {accuracy}')

joblib.dump(model, 'models/counterparty_freeze.joblib')

if __name__ == "__main__":
# Train the model if it hasn't been trained yet
train()
app.run(debug=True)
