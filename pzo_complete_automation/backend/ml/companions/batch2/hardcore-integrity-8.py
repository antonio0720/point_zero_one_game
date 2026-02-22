```python
import hashlib
import numpy as np

def hardcore_integrity_check(model, X, y):
model_hash = hashlib.sha256(str(model).encode()).hexdigest()
data_hash = np.vectorize(hashlib.sha256)
X_hashes = data_hash(X).tostring().decode('utf-8')
y_hashes = hashlib.sha256(y.tobytes()).hexdigest()

integrity_check = model_hash + X_hashes + y_hashes
return integrity_check
```

This function takes a machine learning model, input data X, and target labels y as inputs. It creates hashes for the model, input data, and target labels using the sha256 algorithm from the hashlib library. The model's hash is created by converting the string representation of the model to bytes and then hashing it.

For input data X, a numpy vectorized function is used to create hashes for each data point, which are then concatenated. For target labels y, a simple hash is created using the tobytes() method to convert y into bytes before hashing.

Finally, the model's hash, the hashed input data, and the hashed target labels are combined to create an integrity check string.
