data = pd.read_csv(file_path)
X = data.drop('skill_rating', axis=1)
y = data['skill_rating']
return X, y

def train_model(X_train, y_train):
model = LogisticRegression()
model.fit(X_train, y_train)
return model

def evaluate_model(model, X_test, y_test):
predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)
f1_macro = f1_score(y_test, predictions, average='macro')
return accuracy, f1_macro

def save_model(model, model_file_path):
with open(model_file_path, 'wb') as file:
pickle.dump(model, file)

# Load data
X, y = load_data('path/to/your/dataset.csv')

# Split the data into training and testing sets (80% for training and 20% for testing)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train the model
model = train_model(X_train, y_train)

# Evaluate the model
accuracy, f1_macro = evaluate_model(model, X_test, y_test)
print(f'Accuracy: {accuracy}')
print(f'F1 Macro Score: {f1_macro}')

# Save the trained model to a file
save_model(model, 'path/to/your/saved_model.pkl')
```
