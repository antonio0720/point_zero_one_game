from sklearn.isolation forest import IsolationForest
from sklearn.datasets import make_blobs
import numpy as np

X, y = make_blobs(n_samples=1000, centers=4, n_features=2, random_state=0)
y[350:] = 1  # Introduce anomalies at indices 350 to 699

clf = IsolationForest(n_estimators=100, contamination=0.1)
clf.fit(X)

predictions = clf.predict(X)

scores = -clf.decision_function(X)
anomaly_scores = scores[y==1]
normal_scores = scores[y==0]
print("Mean Anomaly Score: ", np.mean(anomaly_scores))
print("Mean Normal Score: ", np.mean(normal_scores))

from sklearn.metrics import confusion_matrix, accuracy_score
y_pred = clf.predict(X)
confusion = confusion_matrix(y, y_pred)
accuracy = accuracy_score(y, y_pred)
print("Confusion Matrix: ", confusion)
print("Accuracy Score: ", accuracy)
