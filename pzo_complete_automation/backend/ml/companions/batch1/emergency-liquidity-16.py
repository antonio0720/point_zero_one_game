data = pd.read_csv(file_path)
X = data.drop('emergency_liquidity', axis=1)
y = data['emergency_liquidity']
return X, y

def train_model(X_train, y_train):
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)
return model

def evaluate_model(model, X_test, y_test):
y_pred = model.predict(X_test)
mae = mean_absolute_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)
print(f'Mean Absolute Error: {mae}')
print(f'R2 Score: {r2}')

def main():
data_path = 'backend/ml/companions/batch1/emergency-liquidity.csv'
X, y = load_data(data_path)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
model = train_model(X_train, y_train)
evaluate_model(model, X_test, y_test)

if __name__ == "__main__":
main()
```
