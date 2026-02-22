import pandas as pd
import numpy as np
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression

def load_data():
iris = load_iris()
data = pd.DataFrame(iris.data, columns=iris.feature_names)
labels = pd.Series(iris.target)
return data, labels

def preprocess_data(data, labels):
X_train, X_test, y_train, y_test = train_test_split(data, labels, test_size=0.3, random_state=42)
return X_train, X_test, y_train, y_test

def fit_and_predict(X_train, y_train):
model = LogisticRegression()
model.fit(X_train, y_train)
return model

def delete_data_point(model, X, y, index):
if len(X) == 1:
raise ValueError("Cannot delete all data points")

X_new = np.delete(X, index, axis=0)
y_new = np.delete(y, index)

model.fit(X_new, y_new)

def main():
data, labels = load_data()
X_train, X_test, y_train, y_test = preprocess_data(data, labels)
model = fit_and_predict(X_train, y_train)

# Example of deleting a data point with index 2
delete_data_point(model, X_train, y_train, 2)

if __name__ == "__main__":
main()
