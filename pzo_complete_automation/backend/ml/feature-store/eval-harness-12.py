return joblib.load(model_path)

def evaluate(model, X_test, y_test):
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
return accuracy

def main():
model_path = 'model.joblib'
test_data_path = 'test_data.csv'

model = load_model(model_path)
X_test, y_test = load_data(test_data_path)
accuracy = evaluate(model, X_test, y_test)
print('Evaluation Accuracy:', accuracy)

if __name__ == "__main__":
main()
```

This code assumes the following:
- A trained model is saved as a joblib file (`model.joblib`)
- Test data is stored in a CSV file (`test_data.csv`) with labeled instances
- The Scikit-learn library is installed and accessible for loading data and computing accuracy scores
