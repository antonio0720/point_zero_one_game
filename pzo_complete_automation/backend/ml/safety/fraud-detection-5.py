transactions = pd.read_sql_query("SELECT * FROM transactions", DB_CONNECT)
# Preprocess the data as needed (e.g., normalization, one-hot encoding, etc.)
return transactions

# Train the machine learning model on the preprocessed data
def train_model(X, y):
model = RandomForestClassifier(n_estimators=100)
model.fit(X, y)
return model

# Predict if a transaction is fraudulent based on the model and new input
def predict_fraud(model, X_new):
prediction = model.predict(X_new)
return prediction[0]

@app.route('/predict', methods=['POST'])
def predict():
data = request.get_json()
X_new = pd.DataFrame([data], columns=load_data().columns)
model = load_model()  # Assuming a pre-trained model is loaded here
prediction = predict_fraud(model, X_new)
return jsonify({'prediction': str(prediction)})

# Load the pre-trained model if it exists (you can save and load models using pickle or joblib)
def load_model():
# Load the pre-trained model here
pass  # Replace this with your own code to load the pre-trained model

if __name__ == '__main__':
app.run(debug=True)
```
