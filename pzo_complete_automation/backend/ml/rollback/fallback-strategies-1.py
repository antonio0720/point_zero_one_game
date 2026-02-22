import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

class ModelWithRollback:
def __init__(self, model=None):
self.model = model or RandomForestRegressor(random_state=42)
self.fallback_value = 0
self.num_failures = 0
self.kill_switch_threshold = 3

def fit(self, X, y):
self.model.fit(X, y)

def predict(self, X):
if self.num_failures >= self.kill_switch_threshold:
return self.fallback_value
prediction = self.model.predict(X)
error = mean_absolute_error(y, prediction)
if error > 10:  # Adjust this threshold according to your needs
self.num_failures += 1
return prediction

def reset(self):
self.num_failures = 0
