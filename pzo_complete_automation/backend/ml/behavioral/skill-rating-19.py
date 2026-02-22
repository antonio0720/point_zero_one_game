import pandas as pd
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix

# Load data
data = pd.read_csv('data.csv')

# Preprocess data
X = data.drop(['skill_rating'], axis=1)
y = data['skill_rating']

# Split the dataset into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Standardize the features
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)

# Define logistic regression model with grid search for best parameters
params = {
'C': [0.1, 1, 10, 100],
'penalty': ['l1', 'l2']
}

logreg = LogisticRegression()
grid_search = GridSearchCV(estimator=logreg, param_grid=params, cv=5)
grid_search.fit(X_train, y_train)

# Get the best model and evaluate it on the test set
best_model = grid_search.best_estimator_
y_pred = best_model.predict(X_test)
print("Accuracy:", accuracy_score(y_test, y_pred))
print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred))
