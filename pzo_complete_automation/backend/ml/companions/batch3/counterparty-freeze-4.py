import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, confusion_matrix

def load_data(filename):
# Function to load data from a CSV file with given filename
# Implement the logic to read and return the data as a tuple of (X, y)

def train_model(X_train, y_train):
# Initialize and fit the Random Forest Classifier model using the provided training data
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)
return clf

def evaluate_model(clf, X_test, y_test):
# Predict the class labels for test data and calculate accuracy score
y_pred = clf.predict(X_test)
acc = accuracy_score(y_test, y_pred)
conf_matrix = confusion_matrix(y_test, y_pred)
return acc, conf_matrix

def main():
# Load the data from CSV file
data = load_data('counterparty.csv')

# Split the data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(data[0], data[1], test_size=0.2, random_state=42)

# Train the model using the training data
clf = train_model(X_train, y_train)

# Evaluate the trained model on the testing data
acc, conf_matrix = evaluate_model(clf, X_test, y_test)

print('Accuracy: {:.2f}'.format(acc))
print('Confusion Matrix:\n', conf_matrix)

if __name__ == "__main__":
main()
