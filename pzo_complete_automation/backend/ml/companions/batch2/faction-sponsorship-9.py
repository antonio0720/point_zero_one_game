from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import pandas as pd
import numpy as np

def preprocess(df):
# Add your preprocessing steps here if necessary
return df

def build_model():
model = LogisticRegression()
return model

def train(X, y):
model = build_model()
model.fit(X, y)
return model

def evaluate(model, X, y):
predictions = model.predict(X)
score = accuracy_score(y, predictions)
return score

def main():
df = pd.read_csv('data.csv')
df = preprocess(df)
X = df.drop('sponsorship', axis=1)
y = df['sponsorship']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = train(X_train, y_train)
score = evaluate(model, X_test, y_test)
print('Accuracy Score:', score)

if __name__ == "__main__":
main()
