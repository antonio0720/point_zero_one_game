joblib.dump(model, filename)

def load_model(filename):
return joblib.load(filename)

@app.post("/train")
async def train_model(file: UploadFile = File(...)):
data = pd.read_csv(file.file)
drift_detector.fit(data.values)
save_model(drift_detector, "drift_detector.sav")
return {"message": "Model trained successfully"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
data = pd.read_csv(file.file)
predictions = drift_detector.predict(data.values)
results = {"anomaly": [str(p) for p in predictions]}
return results
```

To use this code:
1. Install FastAPI and Scikit-learn libraries: `pip install fastapi[all] scikit-learn`
2. Save the above code as `drift_detection.py`.
3. Run the server with: `uvicorn drift_detection:app --host 0.0.0.0 --port 8000`
4. Access the API at http://localhost:8000/docs for training and predicting data.
