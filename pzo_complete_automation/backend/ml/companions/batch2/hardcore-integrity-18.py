from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
import pandas as pd

def load_data(file_path):
data = pd.read_csv(file_path)
X = data.drop('label', axis=1)
y = data['label']
return X, y

def train_model(X_train, y_train):
model = LogisticRegression()
model.fit(X_train, y_train)
return model

def predict(model, X_test):
predictions = model.predict(X_test)
return predictions

def evaluate(y_true, y_pred):
accuracy = accuracy_score(y_true, y_pred)
return accuracy

if __name__ == "__main__":
file_path = "data/hardcore-integrity-18.csv"
X, y = load_data(file_path)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
model = train_model(X_train, y_train)
predictions = predict(model, X_test)
accuracy = evaluate(y_test, predictions)
print("Accuracy:", accuracy)
