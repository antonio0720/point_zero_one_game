def eval_harness(features_df, labels_df, model_name=None):
model = model_loader_func()
X = feature_generator_func(features_df)
y = labels_df.pop('label').values

scorer = make_scorer(performance_evaluator, greater_is_better=True)
score = scorer(model.predict(X), y)

if model_name:
metrics = {'model_name': [model_name], 'accuracy_score': [score]}
return pd.DataFrame(metrics)
else:
return score

return eval_harness
```

This script creates a function `eval_harness`, which takes a model loader, feature generator, and performance evaluator as arguments. It uses these functions to load a model, generate features from data, evaluate the performance of the model using the specified evaluator, and return the evaluation score(s) as a DataFrame or a single value if only the score is needed. The `create_eval_harness` function returns the `eval_harness` for use in other parts of your code.
