shap_values = explainer(instance).values
important_features = shap_values.argsort()[-5:][::-1]
total_shap_value = sum(shap_values[important_features])
shap_values /= total_shap_value

return {
'feature': list(iris.columns)[important_features],
'shap_values': list(shap_values[important_features]),
}

# Explanation for a sample instance
sample = X_test.iloc[0]
explainer = shap.TreeExplainer(model)
explanation = explain(explainer, sample)

@app.get("/explain/{instance}")
def explain_instance(instance: str):
instance = pd.read_csv(pd.StringIO(instance))
explainer = shap.TreeExplainer(model)
explanation = explain(explainer, instance.iloc[0])

return explanation
```
