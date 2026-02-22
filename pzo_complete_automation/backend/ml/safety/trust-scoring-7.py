```python
import numpy as np

def trust_score(model, input, ground_truth, metadata=None):
prediction = model.predict(input)
error = np.abs(prediction - ground_truth)
if metadata is not None and "integrity_violation" in metadata:
return 0.0

score = 1.0 - error / (1.0 + error)
return score
```

This function calculates the trust score for a given model prediction, ground truth, and optional metadata. If there's an integrity violation in the metadata, it returns a zero trust score. Otherwise, it computes the trust score using the harmonic mean of the difference between the prediction and the ground truth.
