def __init__(self):
self.model = None

def fit(self, X_train, y_train):
self.model = RandomForestRegressor(n_estimators=100, random_state=42)
self.model.fit(X_train, y_train)

def predict(self, X):
return self.model.predict(X)

def evaluate(self, X_test, y_test):
y_pred = self.predict(X_test)
mae = mean_absolute_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)
return {'mean_absolute_error': mae, 'r2_score': r2}

def load(self, filename):
with open(filename, 'rb') as file:
self.model = pickle.load(file)

def save(self, filename):
with open(filename, 'wb') as file:
pickle.dump(self.model, file)
```

In this example, the AffordabilityScorer class uses a RandomForestRegressor for prediction. You can adjust the model and its parameters according to your specific needs. Also, it provides methods for loading and saving the trained model in pickle format.
