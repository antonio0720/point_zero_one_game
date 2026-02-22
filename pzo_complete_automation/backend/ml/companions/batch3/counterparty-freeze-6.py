from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix
import pandas as pd

def load_data(file_path):
data = pd.read_csv(file_path)
X = data.drop('freeze', axis=1)
y = data['freeze']
return X, y

def preprocess_data(X, y):
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

return X_train_scaled, X_test_scaled, y_train, y_test

def train_model(X_train, y_train):
model = LogisticRegression()
model.fit(X_train, y_train)
return model

def evaluate_model(model, X_test, y_test):
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
confusion_matrix_ = confusion_matrix(y_test, y_pred)

print("Accuracy:", accuracy)
print("Confusion Matrix:\n", confusion_matrix_)

def main():
data_path = 'counterparty.csv'
X, y = load_data(data_path)
X_train, X_test, y_train, y_test = preprocess_data(X, y)
model = train_model(X_train, y_train)
evaluate_model(model, X_test, y_test)

if __name__ == "__main__":
main()
