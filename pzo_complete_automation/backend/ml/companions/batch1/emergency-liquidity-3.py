import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix

def load_data(file_path):
return pd.read_csv(file_path)

def preprocess_data(df):
df = df.dropna()
X = df.drop('liquidation', axis=1)
y = df['liquidation']
return X, y

def train_model(X, y):
model = LogisticRegression()
model.fit(X, y)
return model

def evaluate_model(model, X_test, y_test):
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
confusion_matrix_values = confusion_matrix(y_test, y_pred)
return accuracy, confusion_matrix_values

def save_model(model, file_path):
with open(file_path, 'wb') as f:
pickle.dump(model, f)
