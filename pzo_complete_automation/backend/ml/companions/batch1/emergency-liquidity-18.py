import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import pandas as pd

def load_data(file_path):
data = pd.read_csv(file_path)
X = data.drop('target', axis=1)
y = data['target']
return X, y

def train_model(X_train, y_train):
dtrain = xgb.DMatrix(X_train, label=y_train)
params = {
'objective': 'reg:squarederror',
'colsample_bytree': 0.3,
'learning_rate': 0.1,
'max_depth': 5,
'min_child_weight': 2,
}
model = xgb.train(params, dtrain, num_boost_round=100)
return model

def evaluate_model(X_test, y_test, model):
dtest = xgb.DMatrix(X_test)
pred = model.predict(dtest)
mae = mean_absolute_error(y_test, pred)
mse = mean_squared_error(y_test, pred)
r2 = r2_score(y_test, pred)
return mae, mse, r2

def main():
data_path = 'data.csv'
X, y = load_data(data_path)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
model = train_model(X_train, y_train)
mae, mse, r2 = evaluate_model(X_test, y_test, model)
print(f'Mean Absolute Error: {mae}')
print(f'Mean Squared Error: {mse}')
print(f'R2 Score: {r2}')

if __name__ == '__main__':
main()
