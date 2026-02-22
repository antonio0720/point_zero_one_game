import pandas as pd
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.preprocessing import StandardScaler

def load_data(file_path):
return pd.read_csv(file_path)

def preprocess_data(df):
df = df.dropna()
scaler = StandardScaler()
df[['feature1', 'feature2', 'feature3']] = scaler.fit_transform(df[['feature1', 'feature2', 'feature3']])
return df

def split_data(df):
X = df.drop('label', axis=1)
y = df['label']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
return X_train, X_test, y_train, y_test

def tune_model(X_train, y_train):
param_grid = {
'C': [0.1, 1, 10]
}

lr = LogisticRegression()
grid = GridSearchCV(lr, param_grid, cv=5)
grid.fit(X_train, y_train)
return grid.best_estimator_

def evaluate_model(model, X_test, y_test):
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
cm = confusion_matrix(y_test, y_pred)
return accuracy, cm

def main():
data = load_data('fraud_data.csv')
processed_data = preprocess_data(data)
X_train, X_test, y_train, y_test = split_data(processed_data)
model = tune_model(X_train, y_train)
accuracy, cm = evaluate_model(model, X_test, y_test)
print(f'Accuracy: {accuracy}')
print(f'Confusion Matrix:\n{cm}')

if __name__ == '__main__':
main()
