import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix

# Load data (assuming CSV files are present in the appropriate directories)
train_data = pd.read_csv('training_data/rivalry-ledger-12-train.csv')
test_data = pd.read_csv('testing_data/rivalry-ledger-12-test.csv')

# Prepare the data for machine learning model
X_train = train_data.drop('label', axis=1)
y_train = train_data['label']
X_test = test_data.drop('label', axis=1)
y_test = test_data['label']

# Initialize the logistic regression model and fit it to the training data
model = LogisticRegression()
model.fit(X_train, y_train)

# Make predictions on the test set
y_pred = model.predict(X_test)

# Evaluate the performance of the model
accuracy = accuracy_score(y_test, y_pred)
confusion_mat = confusion_matrix(y_test, y_pred)
print(f"Accuracy: {accuracy}")
print(f"Confusion Matrix:\n{confusion_mat}")

# Save the trained model for later use
import joblib
joblib.dump(model, 'rivalry-ledger-12-model.joblib')
