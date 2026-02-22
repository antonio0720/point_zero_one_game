def __init__(self, feature_columns, target, protected_feature):
self.feature_columns = feature_columns
self.target = target
self.protected_feature = protected_feature

def fit(self, X, y, group):
X_train, X_test, y_train, y_test, groups_train, groups_test = train_test_split(X, y, group, test_size=0.3, random_state=42)

self.models = {
'logistic_regression': LogisticRegression(),
'random_forest': RandomForestClassifier()
}

metrics = {
'logistic_regression': ['accuracy', 'roc_auc'],
'random_forest': ['accuracy', 'roc_auc']
}

for model, metric in zip(self.models.keys(), metrics.items()):
scorer = {k: make_scorer(v) for k, v in metric}
self.models[model] = GridSearchCV(
self.models[model],
param_grid={
'logistic_regression': {'C': [0.1, 1, 10]},
'random_forest': {'n_estimators': [50, 100, 200]}
},
scoring=scorer,
refit='roc_auc',
cv=5,
verbose=1,
n_jobs=-1
)
self.models[model].fit(X_train[self.feature_columns], y_train)
self.models[model].fit(X_test[self.feature_columns], y_test)

def predict(self, X):
return np.concatenate([m.predict_proba(X)[..., 1] for m in self.models.values()]).mean(axis=-1)

def evaluate(self, X, y, group):
X_pred = self.predict(X)
aucs, precisions, recalls, fscores, accuracies = [], [], [], [], []

for model in self.models:
auc = roc_auc_score(y, X_pred)
precision, recall, fscore, support = precision_recall_fscore_support(y, X_pred > 0.5)
accuracy = accuracy_score(y, (X_pred > 0.5).astype(int))
aucs.append(auc)
precisions.append(precision)
recalls.append(recall)
fscores.append(fscore)
accuracies.append(accuracy)

group_mean = pd.DataFrame({'AUC': aucs, 'Precision': precisions, 'Recall': recalls, 'F1-Score': fscores, 'Accuracy': accuracies}).mean()
return group_mean.loc[self.protected_feature], group_mean
```
