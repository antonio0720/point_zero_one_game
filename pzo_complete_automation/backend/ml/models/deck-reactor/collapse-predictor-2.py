from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix, classification_report
import pandas as pd
import numpy as np

def load_data(file):
data = pd.read_csv(file)
X = data.drop(['collapse'], axis=1)
y = data['collapse']
return X, y

def train_model(X_train, y_train, params):
model = RandomForestClassifier(**params)
model.fit(X_train, y_train)
return model

def tune_model(X, y, param_grid):
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
clf = GridSearchCV(estimator=RandomForestClassifier(), param_grid=param_grid, cv=5, scoring='f1_macro', n_jobs=-1, verbose=2)
clf.fit(X_train, y_train)
return clf

def evaluate_model(model, X_test, y_test):
y_pred = model.predict(X_test)
print("Accuracy:", accuracy_score(y_test, y_pred))
print("F1 Score:", f1_score(y_test, y_pred, average='macro'))
print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred))
print("Classification Report:\n", classification_report(y_test, y_pred))

def main():
data_file = "deck-reactor.csv"

X, y = load_data(data_file)
param_grid = {
'n_estimators': [10, 50, 100],
'max_depth': [None, 10, 20],
'min_samples_split': [2, 5, 10]
}
clf = tune_model(X, y, param_grid)
model = train_model(clf.best_estimator_.X_train, clf.best_estimator_.y_train, clf.best_estimator_.get_params())
evaluate_model(model, X, y)

if __name__ == "__main__":
main()
