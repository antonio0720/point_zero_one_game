import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix

def load_data():
data = pd.read_csv('emergency-liquidity.csv')
return data

def preprocess_data(data):
# Feature engineering and preprocessing steps if needed
pass

def split_data(data):
X = data.drop(['Emergency Liquidity'], axis=1)
y = data['Emergency Liquidity']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
return X_train, X_test, y_train, y_test

def train_model(X_train, y_train):
model = LogisticRegression()
model.fit(X_train, y_train)
return model

def evaluate_model(model, X_test, y_test):
y_pred = model.predict(X_test)
print('Accuracy Score:', accuracy_score(y_test, y_pred))
print('Confusion Matrix:\n', confusion_matrix(y_test, y_pred))

def save_model(model, model_name):
import joblib
joblib.dump(value=model, filename=f'{model_name}.joblib')

if __name__ == '__main__':
data = load_data()
preprocess_data(data)
X_train, X_test, y_train, y_test = split_data(data)
model = train_model(X_train, y_train)
evaluate_model(model, X_test, y_test)
save_model(model, 'emergency-liquidity')
