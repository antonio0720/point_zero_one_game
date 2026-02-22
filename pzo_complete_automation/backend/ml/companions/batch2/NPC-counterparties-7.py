from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report

# Load and preprocess your dataset here (assuming 'X' as features and 'y' as labels)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

param_grid = {
'n_estimators': [100, 200, 300],
'max_depth': [None, 50, 100],
'min_samples_split': [2, 5, 10]
}

rf_classifier = RandomForestClassifier()
grid_search = GridSearchCV(rf_classifier, param_grid, cv=5)
grid_search.fit(X_train_scaled, y_train)

best_params = grid_search.best_params_
best_rf_classifier = grid_search.best_estimator_

y_pred = best_rf_classifier.predict(X_test_scaled)
print(classification_report(y_test, y_pred))
