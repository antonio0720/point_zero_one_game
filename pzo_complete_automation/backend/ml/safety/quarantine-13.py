def wrapped_model(X):
y_pred = model(X)
if np.any(np.logical_or(y_pred < min_score, y_pred > max_score)):
print(f"Model predictions out of expected range: {y_pred}")
quarantine = True  # You may want to handle quarantining in a more robust way
else:
quarantine = False

return y_pred, quarantine
return wrapped_model
```

You can use this decorator to wrap your existing machine learning model and check for anomalies in the predictions. If you find that quarantining involves more complex actions, consider implementing it using a custom method instead of simply setting `quarantine = True`.
