client = feast.Client('your-feast-service-address')
schema = client.get_entity_schema(entity)
table = feast.TableReference(entity, schema=schema)
data = client.entities.get_time_series(table, time_interval=time_interval).to_pandas().dropna()
return data

def train_test_split(X, y, test_size):
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
return X_train, X_test, y_train, y_test

def create_model():
model = LogisticRegression()
return model

def evaluate_model(y_true, y_pred):
accuracy = accuracy_score(y_true, y_pred)
precision, recall, f1_macro, _ = precision_recall_fscore_support(y_true, y_pred, average='macro')
return {'accuracy': accuracy, 'precision': precision, 'recall': recall, 'f1_macro': f1_macro}

def main():
entity = 'your-feature-entity'
time_interval = feast.TimeInterval.past_day()
data = load_data(entity, time_interval)
X = data.drop('label', axis=1)
y = data['label']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3)
model = create_model()
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
evaluation_result = evaluate_model(y_test, y_pred)

print(evaluation_result)

if __name__ == "__main__":
main()
```
