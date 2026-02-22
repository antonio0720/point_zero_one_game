features: list

class DriftDetector:
def __init__(self, model=None):
if model is None:
self.model = IsolationForest(n_estimators=100, contamination=0.1)
else:
self.model = model

def fit(self, X):
self.model.fit(X)

def predict(self, X):
return self.model.predict(X)

def update(self, X_new):
y_pred = self.predict(X_new)
contaminated = y_pred == -1  # IsolationForest returns -1 for outliers
X_new = X_new[~contaminated]
self.model.partial_fit(X_new, y=None)

def distance(x1, x2):
return pairwise_distances([x1], [x2])[0][0]

drift_detector = DriftDetector()

@app.post("/train/")
async def train(data: list[DataPoint]):
data = [[dp.features for dp in batch] for batch in iterable_chunks(data, len(data[0].features))]
for points in data:
drift_detector.fit(points)
return {"status": "success"}

@app.post("/predict/")
async def predict(data: list[DataPoint]):
data = [[dp.features for dp in batch] for batch in iterable_chunks(data, len(data[0].features))]
predictions = []
for points in data:
preds = drift_detector.predict(points)
predictions += list(preds)
return {"predictions": [{"point_id": str(i), "is_outlier": str(pred)} for i, pred in enumerate(predictions)]}
```

This code includes:

- A FastAPI app with two endpoints: `/train/` for training the drift detector and `/predict/` for making predictions on new data.
- The `DriftDetector` class for managing the Isolation Forest model, with methods for fitting, predicting, and continuous learning (updating).
- Helper functions for chunking data and calculating distances between data points.
