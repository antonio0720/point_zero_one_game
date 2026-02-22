from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
import pandas as pd
import numpy as np

def load_data(file):
data = pd.read_csv(file)
X = data.drop('collapse', axis=1)
y = data['collapse']
return X, y

def train_model(X_train, y_train):
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)
return model

def evaluate_model(model, X_test, y_test):
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
f1_macro = f1_score(y_test, y_pred, average='macro')
return accuracy, f1_macro

def save_model(model, file):
with open(file, 'wb') as f:
pickle.dump(model, f)

def load_model(file):
with open(file, 'rb') as f:
return pickle.load(f)
