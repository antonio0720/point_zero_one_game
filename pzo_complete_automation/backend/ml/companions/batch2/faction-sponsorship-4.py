pred = estimator.predict(X)
score = accuracy_score(y, pred)
return score

# Split the data into training and validation sets
X_train, X_val, y_train, y_val = train_test_split(X_train, y_train, test_size=0.2, random_state=42)

# Perform grid search to find the best hyperparameters for Logistic Regression
param_grid = {
'C': [0.1, 1, 10],
'penalty': ['l1', 'l2']
}

log_reg = LogisticRegression()
grid_search = GridSearchCV(estimator=log_reg, param_grid=param_grid, scoring=faction_sponsorship_scorer, cv=5)
grid_search.fit(X_train, y_train)

# Save the best model to a pickle file for deployment
with open('best_model.pkl', 'wb') as f:
f.write(pickle.dumps(grid_search.best_estimator_))
```
