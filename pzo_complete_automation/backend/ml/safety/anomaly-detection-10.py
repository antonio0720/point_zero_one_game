def __init__(self, n_estimators=100):
self.detector = IsolationForest(n_estimators=n_estimators, contamination=0.05)

def fit(self, X):
self.detector.fit(X)

def predict(self, X):
return self.detector.predict(X)

def load_data(filename):
data = np.loadtxt(open(filename, 'r'), delimiter=',')
return data

if __name__ == "__main__":
data = load_data('your_dataset.csv')
detector = AnomalyDetector()
detector.fit(data)
predictions = detector.predict(data)
print(predictions)
```

You can adjust the `n_estimators` parameter in the constructor to change the number of trees used in the Isolation Forest. Also, you might want to adjust the `contamination` parameter to fine-tune the classifier for your specific dataset.
