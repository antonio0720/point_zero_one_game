import numpy as np
from sklearn.neighbors import KNeighborsClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

def load_data(file_path):
data = np.loadtxt(file_path, delimiter=',')
return data[:, :-1], data[:, -1]

def preprocess_data(X, y):
scaler = StandardScaler()
X = scaler.fit_transform(X)
return X, y, scaler

def train_model(X_train, y_train, X_test=None, y_test=None, k=3):
clf = KNeighborsClassifier(n_neighbors=k)
if X_test is not None and y_test is not None:
clf.fit(X_train, y_train)
scores = clf.score(X_test, y_test)
return clf, scores
else:
clf.fit(X_train, y_train)
return clf

def predict(model, scaler, X):
X = scaler.transform(X)
predictions = model.predict(X)
return predictions
