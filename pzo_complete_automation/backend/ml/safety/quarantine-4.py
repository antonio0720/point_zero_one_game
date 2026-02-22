import numpy as np
from sklearn.neighbors import KNeighborsClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

class QuarantineSystem:
def __init__(self, training_data, num_neighbors=5):
self.num_neighbors = num_neighbors
X_train, X_test, y_train, y_test = train_test_split(training_data, training_data['label'], test_size=0.2)
self.classifier = KNeighborsClassifier(n_neighbors=num_neighbors)
self.classifier.fit(X_train, y_train)

def predict(self, sample):
return self.classifier.predict([sample])[0]

def quarantine(self, sample):
predicted_label = self.predict(sample)
if predicted_label != 1:  # Assuming 1 is the label for safe data
return True
else:
return False
