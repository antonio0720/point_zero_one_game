import numpy as np
from sklearn.metrics import (f Fleiss_kappa, classification_report, confusion_matrix)
from sklearn.utils.class_weight import compute_class_weights

def get_classification_metrics(y_true, y_pred, labels=None):
if labels is None:
labels = np.unique(y_true)

class_weights = compute_class_weights(class_weights='balanced', classes=labels)
weighted_cm = confusion_matrix(y_true, y_pred, weights=class_weights)
report = classification_report(y_true, y_pred, output_dict=True)
kappa = f Fleiss_kappa(y_true, y_pred)

return {'confusion_matrix': weighted_cm.astype('float'),
'classification_report': report,
'Fleiss Kappa': kappa}
