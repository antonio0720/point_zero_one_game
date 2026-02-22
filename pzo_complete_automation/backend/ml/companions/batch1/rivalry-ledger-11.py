import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report

def load_data():
train = pd.read_csv('train.csv')
test = pd.read_csv('test.csv')
return train, test

def preprocess_data(X, y):
X = pd.get_dummies(X)
return X, y

def train_model(X_train, y_train):
model = LogisticRegression()
model.fit(X_train, y_train)
return model

def evaluate_model(model, X_test, y_test):
y_pred = model.predict(X_test)
acc = accuracy_score(y_test, y_pred)
cm = confusion_matrix(y_test, y_pred)
cr = classification_report(y_test, y_pred)
return acc, cm, cr

def main():
train, test = load_data()
X_train, y_train = preprocess_data(*zip(*train.items))
model = train_model(X_train, y_train)
acc, cm, cr = evaluate_model(model, test[0], test[1])
print('Accuracy: {:.4f}'.format(acc))
print('Confusion Matrix:\n', cm)
print('Classification Report:\n', cr)

if __name__ == '__main__':
main()
