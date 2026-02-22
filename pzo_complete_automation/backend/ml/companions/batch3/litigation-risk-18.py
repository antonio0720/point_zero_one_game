from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix

# Load the iris dataset as an example
X, y = load_iris(return_X_y=True)

# Preprocessing: Feature scaling (standardization)
from sklearn.preprocessing import StandardScaler
scaler = StandardScaler()
X = scaler.fit_transform(X)

# Split the data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Initialize a logistic regression model
lr = LogisticRegression()

# Fit the model on training data
lr.fit(X_train, y_train)

# Predict the labels for the test set
y_pred = lr.predict(X_test)

# Evaluate the model performance
accuracy = accuracy_score(y_test, y_pred)
confusion_mat = confusion_matrix(y_test, y_pred)
print("Accuracy:", accuracy)
print("Confusion Matrix:\n", confusion_mat)
