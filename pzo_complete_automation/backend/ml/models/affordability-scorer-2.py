from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import mean_absolute_error, r2_score
import pandas as pd
import numpy as np

class AffordabilityScorer:
def __init__(self, input_features=None, target_feature='target', random_state=42):
self.input_features = input_features
self.target_feature = target_feature
self.random_state = random_state

def fit(self, X, y):
X_train, X_test, y_train, y_test = train_test_split(X[self.input_features], y, test_size=0.2, random_state=self.random_state)

parameters = {
'n_estimators': [10, 50, 100, 200],
'max_depth': [None, 10, 20, 30]
}

rf = RandomForestRegressor(random_state=self.random_state)
grid = GridSearchCV(rf, param_grid=parameters, cv=5, scoring='neg_mean_absolute_error', return_train_score=True)
grid.fit(X_train, y_train)

self.best_model = grid.best_estimator_
self.best_params = grid.best_params_
self.score_, self.train_score_ = grid.cv_results_['mean_test_score'], grid.cv_results_['mean_train_score']

def predict(self, X):
return self.best_model.predict(X)

def evaluate(self, X, y):
predictions = self.predict(X)
mae = mean_absolute_error(y, predictions)
r2 = r2_score(y, predictions)
return mae, r2
