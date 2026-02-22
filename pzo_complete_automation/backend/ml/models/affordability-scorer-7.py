def __init__(self):
self.model = None

def fit(self, X, y):
self.model = LogisticRegression()
self.model.fit(X, y)

def predict(self, X):
return self.model.predict(X)

def score(self, X, y):
return self.model.score(X, y)

def load_data(file_path: str) -> pd.DataFrame:
# Load data from a CSV file and preprocess it if needed
# Replace this with your actual data loading function
data = pd.read_csv(file_path)
return data

def split_data(data):
X = data.drop('target', axis=1)
y = data['target']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
return X_train, X_test, y_train, y_test

def main():
data = load_data('affordability.csv')  # Assuming the dataset is named affordability.csv
X_train, X_test, y_train, y_test = split_data(data)

scorer = AffordabilityScorer()
scorer.fit(X_train, y_train)

predictions = scorer.predict(X_test)
print("Accuracy:", accuracy_score(y_test, predictions))
cm = confusion_matrix(y_test, predictions)
print("Confusion Matrix:\n", cm)

if __name__ == "__main__":
main()
```
