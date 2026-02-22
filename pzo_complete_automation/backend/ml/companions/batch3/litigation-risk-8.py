data = pd.read_csv(filepath)
return data.values

def preprocess_data(X, y):
scaler = StandardScaler()
X = scaler.fit_transform(X)
return X, scaler

def train_model(X, y, scaler):
model = LogisticRegression()
model.fit(X, y)
return model, scaler

def predict(model, scaler, X_new):
X_new = scaler.transform(X_new)
probabilities = model.predict_proba(X_new)[:, 1]
return probabilities

if __name__ == "__main__":
data = load_data("path/to/your/data.csv")
X, y = np.split(data, [len(data[0]) - 1], axis=1)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

X_train, scaler = preprocess_data(X_train, y_train)
model, _ = train_model(X_train, y_train, scaler)

X_test = preprocess_data(X_test, y_test)[0]
probabilities = predict(model, scaler, X_test)
```
