import os
from typing import Dict, Any
from abc import ABC, abstractmethod
from sklearn.metrics import classification_report

class Evaluator(ABC):
@abstractmethod
def evaluate(self, y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
pass

class SklearnEvaluator(Evaluator):
def evaluate(self, y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
return classification_report(y_true, y_pred, output_dict=True)

def evaluate_model(model, X_test, y_test):
evaluator = SklearnEvaluator()
y_pred = model.predict(X_test)
evaluation_result = evaluator.evaluate(y_test, y_pred)
return evaluation_result
