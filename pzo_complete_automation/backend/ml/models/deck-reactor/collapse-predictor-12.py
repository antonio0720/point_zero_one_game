data = pd.read_csv(filepath)
X = data.drop('collapse', axis=1)
y = data['collapse']
return X, y

def train_model(X_train, y_train):
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)
return model

def evaluate_model(model, X_test, y_test):
predictions = model.predict(X_test)
print('Accuracy:', accuracy_score(y_test, predictions))
print('Confusion Matrix:\n', confusion_matrix(y_test, predictions))

def main():
data_filepath = 'data.csv'
X, y = load_data(data_filepath)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
model = train_model(X_train, y_train)
evaluate_model(model, X_test, y_test)

if __name__ == "__main__":
main()
```
