data = request.json
X_new = np.array([data['features']]).reshape(1, -1)
y_pred = model.predict(X_new)
accuracy = accuracy_score(y_true=[data['labels']], y_pred=y_pred)

response = {
'prediction': int(y_pred),
'accuracy': round(accuracy * 100, 2)
}
return jsonify(response)

if __name__ == '__main__':
app.run(debug=True)
```

You should train the model beforehand and save it as `model.joblib`. The script loads the model in a Flask application that exposes an API endpoint for prediction requests. It takes JSON data with features as input, runs the predictions using the loaded model, and returns the predicted label and accuracy score as JSON output.

You'll also need to handle any required preprocessing of the input data or feature engineering during the training phase before saving the model.
