from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.utils.validation import check_X_y
from sklearn.metrics import (f fleiss_kappa, accuracy_score, precision_recall_fscore_support as prfs,
roc_curve, auc, ConfusionMatrixDisplay)
from collections import defaultdict
import numpy as np
import pandas as pd

class FairnessAuditor(BaseEstimator, ClassifierMixin):
def __init__(self, threshold=0.5, positive_class="positive"):
self.threshold = threshold
self.positive_class = positive_class

def fit(self, X, y):
check_X_y(X, y)
super().fit(X, y)
self.groups = set(np.unique(X[:, np.where(X.columns == 'group_id')[0]]))
return self

def _compute_metrics(self, X, y):
y_pred = self.predict_proba(X)[:, 1] > self.threshold
groups = X[:, np.where(X.columns == 'group_id')[0]]
group_sizes = np.bincount(groups.ravel())
group_counts = defaultdict(lambda: defaultdict(int))
for g, c in zip(groups, y):
group_counts[self.positive_class][g] += c

metric_results = {}
for metric, func in [
('accuracy', accuracy_score),
('precision', lambda x, g: func(x[:, g], y)[1]),
('recall', lambda x, g: func(x[:, g], y)[0]),
('f1_score', lambda x, g: prfs.f1_score(y, x[:, g])),
('kappa', lambda x, g: fleiss_kappa(y, x[:, g]))
]:
metric_results[metric] = {}
for group in self.groups:
metric_results[metric][group] = func(y, y_pred[np.where(groups == group)])

true_positive_rates, false_positive_rates, thresholds = roc_curve(y, y_pred)
metric_results['roc_auc'] = auc(false_positive_rates, true_positive_rates)

confusion_matrix = pd.DataFrame(np.bincount(np.concatenate([y, y_pred]), minvalues=0)).transpose()
cm_display = ConfusionMatrixDisplay(confusion_matrix, display_labels=[self.positive_class, 'negative'])
cm_display.plot()

return metric_results

def score(self, X, y, **kwargs):
metrics = self._compute_metrics(X, y)
return np.mean([m for m in metrics.values() if not isinstance(m, (list, dict))])
