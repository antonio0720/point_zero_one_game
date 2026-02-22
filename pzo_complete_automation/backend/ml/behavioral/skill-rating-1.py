data = pd.read_csv(file_path)
X = data.drop('skill_rating', axis=1)
y = data['skill_rating']
return X, y

def train_model(X_train, y_train):
model = LogisticRegression()
model.fit(X_train, y_train)
return model

def evaluate_model(model, X_test, y_test):
predictions = model.predict(X_test)
score = accuracy_score(y_test, predictions)
return score

def main():
data_path = 'path/to/your/data.csv'
X, y = load_data(data_path)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
model = train_model(X_train, y_train)
score = evaluate_model(model, X_test, y_test)
print(f'Accuracy: {score}')

if __name__ == '__main__':
main()
```
