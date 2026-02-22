from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (average_precision_score, classification_report, confusion_matrix, f1_score)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

class FairnessAuditor2:
def __init__(self, base_estimator):
self.base_estimator = CalibratedClassifierCV(base_estimator)

def fit(self, X, y):
self.base_estimator.fit(X, y)
return self

def score(self, X, y, sample_weight=None):
predicted = self.base_estimator.predict_proba(X)[:, 1]
precision = average_precision_score(y, predicted)
report = classification_report(y, self.base_estimator.predict(X))
matrix = confusion_matrix(y, self.base_estimator.predict(X))
f1_macro = f1_score(y, self.base_estimator.predict(X), average='macro')
return precision, report, matrix, f1_macro

def preprocess(self, X):
scaler = StandardScaler()
return scaler.fit_transform(X)
