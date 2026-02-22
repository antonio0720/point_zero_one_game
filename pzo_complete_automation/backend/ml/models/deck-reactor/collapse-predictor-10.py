import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

def load_data(file_path):
data = pd.read_csv(file_path)
X = data.drop('collapse', axis=1)
y = data['collapse']
return X, y

def train_model(X_train, y_train):
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)
return model

def evaluate_model(model, X_test, y_test):
predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)
print(f'Accuracy: {accuracy}')

def save_model(model, file_path):
with open(file_path, 'wb') as f:
pickle.dump(model, f)

def main():
data_file = 'deck-reactor-data.csv'
X, y = load_data(data_file)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = train_model(X_train, y_train)
evaluate_model(model, X_test, y_test)
save_model(model, 'collapse-predictor-10.pkl')

if __name__ == "__main__":
main()
