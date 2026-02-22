def __init__(self, X_train, y_train):
self.X_train = X_train
self.y_train = y_train
self.model = None

def fit(self, hyperparameters=None):
if not hyperparameters:
param_grid = {
'n_estimators': [100, 200, 300],
'max_depth': [None, 50, 100],
'min_samples_split': [2, 5, 10]
}

clf = RandomForestClassifier(random_state=42)
grid_search = GridSearchCV(estimator=clf, param_grid=param_grid, cv=3, scoring='f1_macro')
grid_search.fit(self.X_train, self.y_train)
self.model = grid_search.best_estimator_

else:
self.model = RandomForestClassifier(**hyperparameters).fit(self.X_train, self.y_train)

def predict(self, X):
return self.model.predict(X)

def evaluate(self, X, y):
predicted_labels = self.predict(X)
accuracy = accuracy_score(y, predicted_labels)
f1 = f1_score(y, predicted_labels, average='macro')
return {'accuracy': round(accuracy * 100, 2), 'f1': round(f1 * 100, 2)}
```
