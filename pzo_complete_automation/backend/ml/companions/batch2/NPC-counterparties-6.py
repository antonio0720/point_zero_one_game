import os
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix
from joblib import dump, load

# Load the dataset
data = pd.read_csv('data/counterparty-risk.csv')

# Preprocess data (you may need to adjust this based on your actual data)
X = data.drop(['id', 'default'], axis=1)
y = data['default']

# Split the dataset into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Initialize a Logistic Regression model
model = LogisticRegression()

# Fit the model on training data
model.fit(X_train, y_train)

# Save the trained model to a joblib file
dump(model, 'models/counterparty-risk-model.joblib')

# Evaluate the model on testing data
y_pred = model.predict(X_test)
print('Accuracy:', accuracy_score(y_test, y_pred))
print('Confusion Matrix:\n', confusion_matrix(y_test, y_pred))
