```python
from flask import Flask, request, jsonify
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score
import pandas as pd
import joblib

app = Flask(__name__)

# Load the trained model
model = joblib.load('models/fraud_detection_model.joblib')

@app.route('/predict', methods=['POST'])
def predict():
data = request.json

# Prepare data for prediction
df = pd.DataFrame(data, index=[0])

# Predict fraud and return result as JSON
prediction = model.predict(df)
result = {'fraud': prediction[0]}
return jsonify(result)

if __name__ == '__main__':
app.run(debug=True)
```

Assuming you have a trained Random Forest Classifier named `fraud_detection_model.joblib`, this code sets up a Flask API to receive fraud detection requests and returns the prediction as JSON.

For training the model, load a dataset containing features related to transactions that could indicate fraudulent activity (e.g., amount, location, device used, etc.) and label each transaction as either fraud or not-fraud. After preparing your dataset, you can train and save the RandomForestClassifier model using:

```python
# Load data
data = pd.read_csv('fraud_detection_data.csv')

# Prepare data for training
X = data.drop('fraud', axis=1)
y = data['fraud']

# Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Train the model
model = RandomForestClassifier()
model.fit(X_train, y_train)

# Evaluate the model
y_pred = model.predict(X_test)
print('Accuracy Score:', accuracy_score(y_test, y_pred))
print('F1 Score:', f1_score(y_test, y_pred))

# Save the trained model to a file
joblib.dump(model, 'models/fraud_detection_model.joblib')
```
