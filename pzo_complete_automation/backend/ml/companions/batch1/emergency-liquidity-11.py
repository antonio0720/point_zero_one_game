import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix

def preprocess_data(data):
data['timestamp'] = pd.to_datetime(data['timestamp'])
data['day_of_week'] = data['timestamp'].dt.dayofweek
data['hour_of_day'] = data['timestamp'].dt.hour
data['is_holiday'] = data['day_of_week'].isin([0, 6]) # 0 for Monday and 6 for Sunday
return data.drop(['timestamp'], axis=1)

def prepare_features(data):
X = data.drop('emergency', axis=1)
scaler = StandardScaler()
X = pd.DataFrame(scaler.fit_transform(X), columns=X.columns)
return X, scaler

def train_model(X_train, y_train, scaler):
model = LogisticRegression()
model.fit(X_train, y_train)
return model, scaler

def evaluate_model(model, X_test, y_test, scaler):
X_test = pd.DataFrame(scaler.transform(X_test), columns=X_test.columns)
y_pred = model.predict(X_test)
acc = accuracy_score(y_test, y_pred)
cm = confusion_matrix(y_test, y_pred)
return acc, cm
