data = request.get_json()
if not data:
return jsonify({"error": "No input data provided"}), 400

X = np.array([data]).reshape(-1, 1)

prediction = model.predict(X)
explainer = shap.TreeExplainer(model)
shap_values_prediction = explainer.shap_values(np.array([data]))[0]

result = {
"prediction": float(prediction),
"explanation": shap_values_prediction,
}

return jsonify(result)

if __name__ == "__main__":
app.run(debug=True)
```
