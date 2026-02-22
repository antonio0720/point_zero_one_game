import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix

# Load data
data = pd.read_csv('rivalry-ledger.csv')
X = data[['home_score', 'away_score']]
y = data['winner']

# Initialize logistic regression model
model = LogisticRegression()

# Fit the model to the data
model.fit(X, y)

# Make predictions on the test set (assuming you have preprocessed and loaded the test data into X_test)
predictions = model.predict(X_test)

# Evaluate the model's performance
accuracy = accuracy_score(y_test, predictions)
confusion_mat = confusion_matrix(y_test, predictions)

print("Accuracy:", accuracy)
print("Confusion Matrix:\n", confusion_mat)
