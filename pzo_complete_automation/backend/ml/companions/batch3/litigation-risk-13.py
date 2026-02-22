from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix
import pandas as pd

# Load the dataset (replace 'file.csv' with your actual data file)
data = pd.read_csv('file.csv')

# Prepare features and target variables
X = data.drop('litigation_risk', axis=1)
y = data['litigation_risk']

# Split the dataset into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Initialize logistic regression model
model = LogisticRegression()

# Train the model using training data
model.fit(X_train, y_train)

# Make predictions on testing data
y_pred = model.predict(X_test)

# Evaluate the performance of the model
accuracy = accuracy_score(y_test, y_pred)
confusion_matrix_ = confusion_matrix(y_test, y_pred)

print("Accuracy:", accuracy)
print("Confusion Matrix:\n", confusion_matrix_)
