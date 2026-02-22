import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix

def preprocess(data):
data['Faction Sponsorship'] = data['Faction Sponsorship'].str.replace('Yes', 1).str.replace('No', 0)
return data.dropna()

def train_model(X, y):
model = LogisticRegression(max_iter=1000)
model.fit(X, y)
return model

def evaluate_model(model, X_test, y_test):
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred, average='weighted')
cm = confusion_matrix(y_test, y_pred)
return accuracy, f1, cm

def main():
data = pd.read_csv('data.csv')
data = preprocess(data)
X = data.drop('Faction Sponsorship', axis=1)
y = data['Faction Sponsorship']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = train_model(X_train, y_train)
accuracy, f1, cm = evaluate_model(model, X_test, y_test)

print('Accuracy:', accuracy)
print('F1 Score:', f1)
print('Confusion Matrix:\n', cm)

if __name__ == "__main__":
main()
