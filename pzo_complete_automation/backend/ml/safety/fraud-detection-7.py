data = pd.read_csv(file_path)
X = data.drop('label', axis=1)
y = data['label']
return X, y

def tune_model():
X, y = load_data('fraud_data.csv')
model = RandomForestClassifier()

parameters = {
'n_estimators': [100, 200, 300],
'max_depth': [None, 10, 20],
'min_samples_split': [2, 5, 10]
}

grid = GridSearchCV(estimator=model, param_grid=parameters, scoring='f1', cv=3)
grid.fit(X, y)
best_params = grid.best_params_

return model, best_params

def train(X, y, model, params):
model.set_params(**params)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
model.fit(X_train, y_train)
y_pred = model.predict(X_test)
print("Training Accuracy:", accuracy_score(y_test, y_pred))
print("F1 Score:", f1_score(y_test, y_pred))

def main():
model, best_params = tune_model()
X, y = load_data('fraud_data.csv')
train(X, y, model, best_params)

if __name__ == "__main__":
main()
```
