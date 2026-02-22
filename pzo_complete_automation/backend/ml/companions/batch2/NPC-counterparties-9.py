import pandas as pd
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix

# Load data
data = pd.read_csv('counterparty_data.csv')

# Preprocess the data (features extraction, labeling, normalization, etc.)
X = data.drop('Counterparty_Behavior', axis=1)
y = data['Counterparty_Behavior']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Define the model and hyperparameters grid
model = RandomForestClassifier()
param_grid = {
'n_estimators': [100, 200, 300],
'max_depth': [None, 50, 100],
'min_samples_split': [2, 5, 10]
}

# Perform grid search for best hyperparameters
grid = GridSearchCV(estimator=model, param_grid=param_grid, scoring='accuracy', cv=3)
grid.fit(X_train, y_train)
best_params = grid.best_params_

# Train the model with optimal hyperparameters
best_model = RandomForestClassifier(n_estimators=best_params['n_estimators'], max_depth=best_params['max_depth'], min_samples_split=best_params['min_samples_split'])
best_model.fit(X_train, y_train)

# Evaluate the model on test data
y_pred = best_model.predict(X_test)
print('Accuracy:', accuracy_score(y_test, y_pred))
print('Confusion Matrix:\n', confusion_matrix(y_test, y_pred))
