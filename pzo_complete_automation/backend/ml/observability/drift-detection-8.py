model = base_learner()
buffer = deque(maxlen=buffer_size)
roc_scores = deque(maxlen=buffer_size)
current_roc_score = 0

for x, y_true in zip(X, y):
y_pred = model.predict(x)
roc_score = roc_auc_score(y_true, y_pred)
buffer.append((x, y_true))
roc_scores.append(roc_score)
current_roc_score = np.mean(np.array(roc_scores))

if abs(current_roc_score - previous_roc_score) > alpha:
print("Drift detected! Update the model.")
model = base_learner()
for data in buffer:
model.partial_fit(data[0], data[1])
previous_roc_score = current_roc_score

return model

def main():
X = np.array([...]) # your feature matrix
y = np.array([...]) # your target labels

drift_detector_svm = online_drift_detection(SVC, X, y)
drift_detector_ann = online_drift_detection(KNeighborsClassifier, X, y)

if __name__ == "__main__":
main()
```
