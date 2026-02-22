import numpy as np
from sklearn.metrics import (mean_absolute_error, mean_squared_error, r2_score)
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier

class FairnessAuditor4:
def __init__(self, base_estimator, calibration_strategy='isotonic', random_state=42):
self.base_estimator = base_estimator
self.calibrated_classifier = CalibratedClassifierCV(
base_estimator, calibration_method=calibration_strategy, cv='prefit', random_state=random_state)

def fit(self, X, y):
return self.calibrated_classifier.fit(X, y)

def predict(self, X):
return self.calibrated_classifier.predict_proba(X)[:, 1]

def evaluate(self, X, y, sample_weight=None):
y_pred = self.predict(X)
mae = mean_absolute_error(y, y_pred, sample_weight=sample_weight)
mse = mean_squared_error(y, y_pred, sample_weight=sample_weight)
r2 = r2_score(y, y_pred, sample_weight=sample_weight)
return {"mae": mae, "mse": mse, "r2": r2}
