def __init__(self, X_train, y_train):
self.X_train = X_train
self.y_train = y_train
self.model = None

def fit(self):
param_grid = {
'n_estimators': [100, 200, 300],
'max_depth': [None, 50, 100],
'min_samples_split': [2, 5, 10]
}

self.model = GridSearchCV(RandomForestClassifier(), param_grid, cv=3)
self.model.fit(self.X_train, self.y_train)

def predict(self, X_test):
return self.model.predict(X_test)

def main():
data = pd.read_csv('deck_reactor_data.csv')
X = data.drop('collapse', axis=1)
y = data['collapse']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

collapse_predictor = CollapsePredictor(X_train, y_train)
collapse_predictor.fit()

predictions = collapse_predictor.predict(X_test)
print('Accuracy:', accuracy_score(y_test, predictions))

if __name__ == "__main__":
main()
```
