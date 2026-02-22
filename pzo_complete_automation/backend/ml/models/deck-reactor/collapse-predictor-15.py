import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import accuracy_score, f1_score

def load_data(file_path):
data = np.loadtxt(file_path, delimiter=',', dtype='float32')
X = data[:, :-1]
y = data[:, -1].astype('int64')
return X, y

def create_model():
model = RandomForestClassifier(n_estimators=100, max_depth=25)
return model

def tune_model(X, y):
param_grid = {
'n_estimators': [50, 100, 150],
'max_depth': [15, 25, 35]
}

grid_search = GridSearchCV(create_model(), param_grid, cv=5)
grid_search.fit(X, y)
return grid_search.best_estimator_

def evaluate_model(model, X_test, y_test):
predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)
f1 = f1_score(y_test, predictions, average='weighted')
return accuracy, f1

if __name__ == "__main__":
X, y = load_data('collapse_predictor_dataset.csv')
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

model = tune_model(X_train, y_train)
accuracy, f1 = evaluate_model(model, X_test, y_test)
print(f'Accuracy: {accuracy}, F1 Score: {f1}')
