import pandas as pd
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score

# Load the data
data = pd.read_csv('emergency_liquidity.csv')
X = data[['features']]
y = data['target']

# Split the dataset into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Initialize the XGBoost classifier with grid search for hyperparameters
param_grid = {
'learning_rate': [0.1, 0.3],
'max_depth': [5, 10],
'n_estimators': [100, 200]
}
xgb_clf = XGBClassifier(random_state=42)
grid_search = GridSearchCV(xgb_clf, param_grid, cv=5, scoring='accuracy')
grid_search.fit(X_train, y_train)

# Train the model with the best hyperparameters found by grid search
best_params = grid_search.best_params_
xgb_clf.set_params(**best_params)
xgb_clf.fit(X_train, y_train)

# Evaluate the trained model on the testing dataset
y_pred = xgb_clf.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print('Accuracy:', accuracy)
