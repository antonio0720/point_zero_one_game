from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import mean_absolute_error
import pandas as pd
import numpy as np

class AffordabilityScorer:
def __init__(self, X, y):
self.X = X
self.y = y
self.model = None

def fit(self, n_estimators=100, max_depth=None, random_state=42):
X_train, X_test, y_train, y_test = train_test_split(self.X, self.y, test_size=0.3, random_state=42)

param_grid = {
'n_estimators': [50, 100, 200],
'max_depth': None
}

rf = RandomForestRegressor(random_state=42)
grid_search = GridSearchCV(rf, param_grid, cv=5, scoring='mean_absolute_error', n_jobs=-1)
grid_search.fit(X_train, y_train)

self.model = grid_search.best_estimator_

def predict(self, X):
return self.model.predict(X)

def evaluate(self, X, y):
predictions = self.predict(X)
mae = mean_absolute_error(y, predictions)
return mae
