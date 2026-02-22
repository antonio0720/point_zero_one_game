import numpy as np
from sklearn.metrics import mean_absolute_error, make_scorer
from sklearn.model_selection import train_test_split, GridSearchCV
from xgboost import XGBRegressor

def fairness_auditor(train_data, test_data, sensitive_feature, target):
# Split data with balanced classes for sensitive feature
train_sensitive_balanced, _, _ = train_test_split(
train_data[:, sensitive_feature], train_labels=train_data[:, target], stratify=train_data[:, sensitive_feature], random_state=42)

# Train the XGBoost model on balanced data
xg_model = XGBRegressor(objective='reg:squarederror', n_estimators=100, learning_rate=0.05, max_depth=3)
xg_model.fit(train_data[:, train_data.columns != sensitive_feature], train_sensitive_balanced)

# Predict on test data and compute MAE for all groups and overall
test_predictions = xg_model.predict(test_data[:, test_data.columns != sensitive_feature])
mae_scorer = make_scorer(mean_absolute_error)
grouped_mae = {}

for group in np.unique(test_data[sensitive_feature]):
group_mask = (test_data[sensitive_feature] == group).astype(int)
mae = mae_scorer(test_predictions, test_data[:, target][group_mask])
grouped_mae[f"Group_{group}"] = mae

overall_mae = mae_scorer(test_predictions, test_data[:, target])

# Print fairness metrics and overall MAE
print("Fairness Metrics: ", grouped_mae)
print("Overall MAE:", overall_mae)

# Example usage with iris dataset
from sklearn.datasets import load_iris
from sklearn.model_selection import cross_val_score

iris = load_iris()
X = iris.data
y = iris.target
sensitive_feature = "species"

# Balance classes for the sensitive feature
balanced_indices = np.random.choice(np.arange(len(X)), size=len(X), replace=(len(np.unique(X[:, sensitive_feature])) > 2), p=[min(len(X[sensitive_feature==g]), len(X[sensitive_feature!=g])) for g in np.unique(X[:, sensitive_feature])])
X = X[balanced_indices, :]
y = y[balanced_indices]
sensitive_feature = X[:, sensitive_feature]

fairness_auditor(X, iris.target, sensitive_feature, "petal length (cm)")
