from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
import pandas as pd

# Load the preprocessed dataset
data = pd.read_csv('your_preprocessed_data.csv')

# Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(data.drop(['target_variable'], axis=1), data['target_variable'], test_size=0.3, random_state=42)

# Define the logistic regression model and set the parameters for GridSearchCV
logreg = LogisticRegression()

param_grid = {
'C': [0.1, 1, 10, 100],
}

grid_search = GridSearchCV(estimator=logreg, param_grid=param_grid, scoring='accuracy', cv=5)
grid_search.fit(X_train, y_train)

# Get the best parameters and evaluate the model on test set
best_params = grid_search.best_params_
print('Best parameters:', best_params)
best_logreg = logreg.set_params(**best_params)
y_pred = best_logreg.predict(X_test)

# Evaluate the model performance
print("Accuracy:", accuracy_score(y_test, y_pred))
print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))
print("Classification Report:")
print(classification_report(y_test, y_pred))
