import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix

# Load dataset (replace 'data.csv' with your dataset file)
data = pd.read_csv('data.csv')

# Preprocess data (assuming that you have features X and label y)
X = data.drop('label', axis=1)
y = data['label']

# Split the dataset into training set and test set
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Initialize the Logistic Regression model
model = LogisticRegression()

# Fit the model to the training data
model.fit(X_train, y_train)

# Predict the labels for test set samples
y_pred = model.predict(X_test)

# Calculate accuracy score and print it
accuracy = accuracy_score(y_test, y_pred)
print('Accuracy:', accuracy)

# Print confusion matrix
confusion_mat = confusion_matrix(y_test, y_pred)
print('\nConfusion Matrix:\n', confusion_mat)
