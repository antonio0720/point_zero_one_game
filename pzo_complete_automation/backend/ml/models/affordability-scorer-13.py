import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import accuracy_score, f1_score
from joblib import dump, load

# Load data (replace this with your data loading function)
X_train, X_test, y_train, y_test = load_data()

# Split the data into training and validation sets
X_train, X_val, y_train, y_val = train_test_split(X_train, y_train, test_size=0.2, random_state=42)

# Define the hyperparameters to tune for Random Forest
param_grid = {
'n_estimators': [100, 200, 300],
'max_depth': [None, 50, 100],
}

# Initialize and train the model using GridSearchCV
rf = RandomForestClassifier()
grid_search = GridSearchCV(estimator=rf, param_grid=param_grid, cv=3, n_jobs=-1)
grid_search.fit(X_train, y_train)

# Save the best model to a file
best_model = grid_search.best_estimator_
dump(best_model, 'affordability-scorer-13.joblib')

# Evaluate the performance on validation set
y_pred = best_model.predict(X_val)
accuracy = accuracy_score(y_val, y_pred)
f1 = f1_score(y_val, y_pred, average='weighted')
print("Validation Accuracy: {:.4f}, F1 Score: {:.4f}".format(accuracy, f1))
