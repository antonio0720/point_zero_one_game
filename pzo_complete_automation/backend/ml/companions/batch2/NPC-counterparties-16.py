from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import pandas as pd

# Loading data
data = pd.read_csv('counterparty_data.csv')

# Preprocessing data
X = data.drop(['Counterparty', 'Behavior'], axis=1)
y = data['Behavior']

# Splitting the data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Creating a Random Forest Classifier with 100 trees
model = RandomForestClassifier(n_estimators=100)

# Fitting the model to the training data
model.fit(X_train, y_train)

# Making predictions on the test data
predictions = model.predict(X_test)
