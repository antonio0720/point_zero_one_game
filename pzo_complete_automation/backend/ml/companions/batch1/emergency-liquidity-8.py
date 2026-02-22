import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, confusion_matrix

def load_data(file_path):
return pd.read_csv(file_path)

def preprocess_data(df):
df = df.dropna()  # Drop missing values
return df

def create_model():
model = LogisticRegression(max_iter=1000, solver='lbfgs')
return model

def train_model(X, y, model):
model.fit(X, y)
return model

def evaluate_model(X, y, model):
y_pred = model.predict(X)
auc_score = roc_auc_score(y, y_pred)
cm = confusion_matrix(y, y_pred)
return auc_score, cm

def predict(model, X):
return model.predict(X)
