import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix

def load_data(file_path):
return pd.read_csv(file_path)

def preprocess_data(df):
df = df.dropna()
X = df.drop('target', axis=1)
y = df['target']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
return X_train, X_test, y_train, y_test

def train_model(X_train, y_train):
model = LogisticRegression()
model.fit(X_train, y_train)
return model

def predict_emergency_liquidity(model, X_test):
predictions = model.predict(X_test)
return predictions

def evaluate_model(y_true, y_pred):
accuracy = accuracy_score(y_true, y_pred)
confusion_matrix_values = confusion_matrix(y_true, y_pred)
return accuracy, confusion_matrix_values

def main():
data = load_data('emergency-liquidity.csv')
X_train, X_test, y_train, y_test = preprocess_data(data)
model = train_model(X_train, y_train)
predictions = predict_emergency_liquidity(model, X_test)
accuracy, confusion_matrix_values = evaluate_model(y_test, predictions)
print("Accuracy:", accuracy)
print("Confusion Matrix:\n", confusion_matrix_values)

if __name__ == "__main__":
main()
