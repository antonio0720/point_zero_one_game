model.fit(X_train, X_train.pop('target'))

def calculate_drift_score(X_test, threshold=0.1):
y_pred = model.predict(X_test)
mse = mean_squared_error(y_true=X_test['target'], y_pred=y_pred)
drift_score = (mse - min_mse) / max_mse * 100
return drift_score > threshold

min_mse, max_mse = calculate_drift_score(X_train, threshold=0)

class DriftDetectModel(BaseModel):
drift: bool

@app.get("/predict")
def predict(data: pd.DataFrame):
y_pred = model.predict(data)
drift = calculate_drift_score(data)
return DriftDetectModel(drift=drift)
```

In this example, I used CatBoostRegressor as the base model, but you can replace it with any other machine learning algorithm of your choice. Also, you need to adjust the drift threshold and the method for training the model according to your specific use case.
