To train the model, you can use Scikit-learn's functions like `train_test_split`, `fit`, and `predict`. Save the trained model using pickle:

```python
# Assuming X and y are your feature matrix and target labels, respectively
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

with open('skill_rating_model.pkl', 'wb') as f:
pickle.dump(model, f)
