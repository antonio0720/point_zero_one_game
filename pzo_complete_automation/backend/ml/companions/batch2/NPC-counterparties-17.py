import pandas as pd
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, f1_score

# Load data
data = pd.read_csv('npc-counterparties.csv')

# Preprocess data
X = data.drop(['Counterparty', 'IsNPC'], axis=1)
y = data['IsNPC']

# Scale features
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.3, random_state=42)

# Define the model and hyperparameters for GridSearchCV
model = XGBClassifier()
params = {
'learning_rate': [0.1, 0.5, 1],
'max_depth': [3, 5, 7, 9],
'n_estimators': [100, 200, 300]
}

# Perform grid search for best hyperparameters
grid_search = GridSearchCV(model, params, cv=5)
grid_search.fit(X_train, y_train)

# Train the model with the best hyperparameters found during grid search
best_model = grid_search.best_estimator_
best_model.fit(X_train, y_train)

# Evaluate the model on test set
y_pred = best_model.predict(X_test)
print('Accuracy:', accuracy_score(y_test, y_pred))
print('F1 Score:', f1_score(y_test, y_pred))
