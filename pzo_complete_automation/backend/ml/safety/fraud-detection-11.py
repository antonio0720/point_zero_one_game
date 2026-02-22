data = pd.read_csv(filepath)
X = data.drop('label', axis=1)  # Features
y = data['label']  # Target variable (0 for legitimate, 1 for fraudulent)
return X, y

def preprocess_data(X):
# Perform any necessary data cleaning, encoding, normalization, etc.
# This is place holder code as you didn't specify any preprocessing steps
return X

def create_model():
model = LogisticRegression()
return model

def tune_model(X_train, y_train):
param_grid = {
'C': [0.1, 1, 10, 100],
'penalty': ['l1', 'l2']
}

grid_search = GridSearchCV(create_model(), param_grid, cv=5)
grid_search.fit(X_train, y_train)
return grid_search

def train(X, y):
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
model = tune_model(X_train, y_train)
model.fit(X_train, y_train)
return model

def evaluate(model, X_test, y_test):
y_pred = model.predict(X_test)
print("Accuracy:", accuracy_score(y_test, y_pred))
print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred))
print("\nClassification Report:\n", classification_report(y_test, y_pred))
```

This code includes functions for loading data, preprocessing data, creating a logistic regression model, tuning the model using Grid Search CV, training the model, and evaluating its performance. You can adjust the data preprocessing function as needed for your specific dataset.
