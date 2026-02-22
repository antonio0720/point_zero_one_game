Here is the Python file `backend/src/ml/moment_classifier/moment_classifier_model.py` as per your specifications:

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from onnxruntime.tools import convert

class MomentClassifierModel:
    def __init__(self):
        self.scaler = StandardScaler()
        self.clf = LogisticRegression()

    def preprocess(self, data: pd.DataFrame) -> pd.DataFrame:
        data[['delta_cash', 'delta_assets']] = self.scaler.fit_transform(data[['delta_cash', 'delta_assets']])
        return data

    def train(self, X: np.ndarray, y: np.ndarray) -> None:
        self.clf.fit(X, y)

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.clf.predict_proba(X)[:, 1]

    def export_onnx(self, model_path: str) -> None:
        input_name = self.clf.classes_[0]
        output_name = 'output'
        convert(self.clf, model_path, input_name=input_name, output_name=output_name)
