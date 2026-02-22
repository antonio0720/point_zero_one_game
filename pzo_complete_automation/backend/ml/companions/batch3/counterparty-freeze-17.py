import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix

def load_data(file_path):
data = pd.read_csv(file_path)
X = data.drop('freeze', axis=1)
y = data['freeze']
return X, y

def train_model(X_train, y_train):
model = LogisticRegression()
model.fit(X_train, y_train)
return model

def evaluate_model(model, X_test, y_test):
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
confusion = confusion_matrix(y_test, y_pred)
return accuracy, confusion

def save_model(model, model_path):
with open(model_path, 'wb') as file:
pickle.dump(model, file)

def load_model(model_path):
with open(model_path, 'rb') as file:
return pickle.load(file)
