from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score

class FactionSponsorshipModel:
def __init__(self):
self.clf = LogisticRegression()

def fit(self, X, y):
self.clf.fit(X, y)

def predict(self, X):
return self.clf.predict(X)

def evaluate(self, X, y):
y_pred = self.predict(X)
accuracy = accuracy_score(y, y_pred)
f1 = f1_score(y, y_pred, average='weighted')
return {"accuracy": accuracy, "f1_score": f1}
