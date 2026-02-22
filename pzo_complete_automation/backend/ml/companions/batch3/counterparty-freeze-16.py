import torch
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

def preprocess(data):
data = StandardScaler().fit_transform(data)
return torch.Tensor(data)

def build_model():
model = RandomForestClassifier(n_estimators=100, random_state=42)
return model

def train(model, X_train, y_train):
model.fit(X_train, y_train)

def predict(model, X):
return model.predict(X)

if __name__ == "__main__":
data = ...  # Load your data here
labels = ...  # Load your labels here

X_train, X_test, y_train, y_test = train_test_split(data, labels, test_size=0.2, random_state=42)
X_train = preprocess(X_train)
X_test = preprocess(X_test)

model = build_model()
train(model, X_train, y_train)

y_pred = predict(model, X_test)
