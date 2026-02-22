data = np.loadtxt(filename, delimiter=",")
return data

def preprocess_data(X, y):
scaler = StandardScaler()
X = scaler.fit_transform(X)
return X, scaler

def train_model(X, y, scaler):
model = LogisticRegression()
model.fit(X, y)
return model, scaler

def predict(model, X, scaler):
X = scaler.transform(X)
predictions = model.predict(X)
return predictions

def evaluate_model(y_true, y_pred):
accuracy = accuracy_score(y_true, y_pred)
cm = confusion_matrix(y_true, y_pred)
return accuracy, cm

def process_batch(data, batch_size=1000):
X = data[:, :-1]
y = data[:, -1]
for i in range(0, len(X), batch_size):
X_batch = X[i:i + batch_size]
y_batch = y[i:i + batch_size]
X_train, X_test, y_train, y_test = train_test_split(X_batch, y_batch, test_size=0.2)
X_train, scaler = preprocess_data(X_train, y_train)
model, _ = train_model(X_train, y_train, scaler)
predictions = predict(model, X_test, scaler)
accuracy, cm = evaluate_model(y_test, predictions)
print("Batch Accuracy:", accuracy)
print("Batch Confusion Matrix:\n", cm)

if __name__ == "__main__":
data = load_data('batch2_hardcore-integrity-11.csv')
process_batch(data)
```
