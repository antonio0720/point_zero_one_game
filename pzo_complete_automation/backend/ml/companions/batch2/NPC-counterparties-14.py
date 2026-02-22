data = pd.read_csv(file_path)
X = data.drop('Counterparty', axis=1)
y = data['Counterparty']
return X, y

def preprocess_data(X):
# Add any necessary data preprocessing steps here
return X

def tune_model(X_train, y_train):
param_grid = {
'n_estimators': [100, 200, 300],
'max_depth': [None, 15, 25],
'min_samples_split': [2, 5, 10]
}

scorer = make_scorer(f1_score, average='weighted')
grid_search = GridSearchCV(RandomForestClassifier(), param_grid, scoring=scorer)
grid_search.fit(X_train, y_train)
return grid_search.best_estimator_

def evaluate_model(X_test, y_test, model):
predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)
f1 = f1_score(y_test, predictions, average='weighted')
return accuracy, f1

def main():
data_path = 'data/NPC-counterparties.csv'
X, y = load_data(data_path)
X = preprocess_data(X)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
model = tune_model(X_train, y_train)
accuracy, f1 = evaluate_model(X_test, y_test, model)

print("Accuracy:", accuracy)
print("F1 Score:", f1)

if __name__ == "__main__":
main()
```
