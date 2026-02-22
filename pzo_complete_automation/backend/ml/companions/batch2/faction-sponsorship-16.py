from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

params = {
'n_estimators': [100, 200],
'max_depth': [None, 50],
'min_samples_split': [2, 5]
}

rf = RandomForestClassifier()
grid = GridSearchCV(rf, param_grid=params, cv=3)
grid.fit(X_train, y_train)

y_pred = grid.predict(X_test)
print("Accuracy:", accuracy_score(y_test, y_pred))
