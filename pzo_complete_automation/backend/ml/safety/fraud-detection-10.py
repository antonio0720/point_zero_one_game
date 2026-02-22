from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import pandas as pd

def load_data(filepath):
"""Loads the dataset from a given file path."""
return pd.read_csv(filepath)

def preprocess_data(data):
"""Preprocesses the data by normalizing and scaling features."""
# Normalize/scale features as needed
# ...
return data

def split_data(data, test_size=0.2):
"""Splits the dataset into training and testing sets."""
return train_test_split(data, test_size=test_size)

def build_model():
"""Builds the Random Forest Classifier model."""
clf = RandomForestClassifier(n_estimators=100, random_state=42)
return clf

def train_model(model, X_train, y_train):
"""Trains the given model on training data."""
model.fit(X_train, y_train)

def evaluate_model(model, X_test, y_test):
"""Evaluates the performance of the given model on testing data."""
y_pred = model.predict(X_test)

accuracy = accuracy_score(y_test, y_pred)
precision = precision_score(y_test, y_pred)
recall = recall_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)

return accuracy, precision, recall, f1

def main():
data = load_data('path/to/your/dataset.csv')
data = preprocess_data(data)
data = split_data(data)

X_train, X_test, y_train, y_test = data

model = build_model()
train_model(model, X_train, y_train)

accuracy, precision, recall, f1 = evaluate_model(model, X_test, y_test)

print('Accuracy: {:.2f}'.format(accuracy))
print('Precision: {:.2f}'.format(precision))
print('Recall: {:.2f}'.format(recall))
print('F1 Score: {:.2f}'.format(f1))

if __name__ == "__main__":
main()
