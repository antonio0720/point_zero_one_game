data = pd.read_csv(file_path)
X = data.drop('skill_rating', axis=1)
y = data['skill_rating']
return X, y

def preprocess_data(X):
scaler = StandardScaler()
onehot = OneHotEncoder(sparse=False)

X_scaled = scaler.fit_transform(X)
X_onehot = pd.DataFrame(onehot.fit_transform(X_scaled))
X_final = pd.concat([X_scaled, X_onehot], axis=1)
return X_final

def create_model():
model = LogisticRegression()
return model

def evaluate_model(model, X_train, y_train, X_test, y_test):
y_pred = model.predict(X_test)
acc = accuracy_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred, average='weighted')
return acc, f1

def train_model(X, y):
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

X_preprocessed = preprocess_data(X_train)
model = create_model()

param_grid = {
'C': [0.1, 1, 10],
'penalty': ['l1', 'l2']
}

grid_search = GridSearchCV(estimator=model, param_grid=param_grid, scoring='f1_weighted', cv=5)
grid_search.fit(X_preprocessed, y_train)

best_params = grid_search.best_params_
print('Best parameters:', best_params)

model.set_params(**best_params)
model.fit(X_preprocessed, y_train)

acc, f1 = evaluate_model(model, X_train, y_train, X_test, y_test)
print('Training accuracy:', acc)
print('Training F1 score:', f1)

if __name__ == "__main__":
data_path = 'data/behavioral_skill_ratings.csv'
X, y = load_data(data_path)
train_model(X, y)
```

This script loads the data from a CSV file, preprocesses it, creates a logistic regression model using grid search cross-validation for hyperparameter tuning, and trains the final model. The best hyperparameters are printed along with training accuracy and F1 score.
