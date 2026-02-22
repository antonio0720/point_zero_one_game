data = pd.read_csv(file_path)
X = data[['income', 'debt_ratio']]
y = data['affordable']
return X, y

def evaluate_model(X_train, y_train, X_test, y_test):
clf = RandomForestClassifier()
parameters = {
'n_estimators': [10, 50, 100],
'max_depth': [None, 10, 20]
}
grid_search = GridSearchCV(clf, param_grid=parameters, scoring='accuracy', cv=3)
grid_search.fit(X_train, y_train)

print('Best parameters: ', grid_search.best_params_)
print('Best score: ', grid_search.best_score_)

clf = RandomForestClassifier(n_estimators=grid_search.best_params_['n_estimators'], max_depth=grid_search.best_params_['max_depth'])
clf.fit(X_train, y_train)

y_pred = clf.predict(X_test)
print('Accuracy: ', accuracy_score(y_test, y_pred))
print('Confusion Matrix:\n', confusion_matrix(y_test, y_pred))
print('Classification Report:\n', classification_report(y_test, y_pred))

def main():
X, y = load_data('affordability_scorer.csv')
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
evaluate_model(X_train, y_train, X_test, y_test)

if __name__ == '__main__':
main()
```
