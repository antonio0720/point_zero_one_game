```python
import os
import joblib

def load_model(filename):
return joblib.load(os.path.join('models', filename))

def save_model(model, filename):
joblib.dump(model, os.path.join('models', filename))

def instant_disable():
model = load_model('model.joblib')
model.coef_[0] = 0
save_model(model, 'model.joblib')

# Usage example:
instant_disable()
```

This code assumes that a trained machine learning model is saved in the `models` folder as a joblib file named `model.joblib`. The instant disable function adjusts the first coefficient of the model to zero, effectively disabling it without deleting or reloading the entire model. You can call the `instant_disable()` function at any time to disable the model instantly in your production environment.
