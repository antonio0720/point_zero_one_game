import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix

def preprocess(data):
data = pd.read_csv(data)  # Load the data
data.dropna(inplace=True)  # Remove missing values
return data

def split_and_scale(X, y, test_size=0.3, random_state=42):
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=random_state)
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)
return X_train_scaled, y_train, X_test_scaled, y_test

def train_and_evaluate(X_train, y_train, X_test, y_test):
clf = LogisticRegression()
clf.fit(X_train, y_train)
y_pred = clf.predict(X_test)
acc = accuracy_score(y_test, y_pred)
cm = confusion_matrix(y_test, y_pred)
return acc, cm

def main():
data = preprocess('data.csv')  # Load the preprocessed data (assuming it's already been processed)
X = data.drop('counterparty', axis=1)  # Features
y = data['counterparty']  # Target variable
X_train, y_train, X_test, y_test = split_and_scale(X, y)
acc, cm = train_and_evaluate(X_train, y_train, X_test, y_test)
print("Accuracy:", acc)
print("Confusion Matrix:\n", cm)

if __name__ == "__main__":
main()
