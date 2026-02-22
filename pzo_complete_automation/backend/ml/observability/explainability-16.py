import xgboost as xgb
import shap
from sklearn.datasets import load_boston
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
from xgboost.callback import EarlyStoppingCallback

def create_dataset():
boston = load_boston()
X = boston.data
y = boston.target
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
return X_train, X_test, y_train, y_test

def create_model():
xg_reg = xgb.XGBRegressor(
objective="reg:squarederror",
eval_metric="rmse",
early_stopping_rounds=5,
n_estimators=100,
learning_rate=0.01,
max_depth=4,
min_child_weight=1,
gamma=0,
subsample=0.8,
colsample_bytree=0.8
)
return xg_reg

def train(X_train, y_train):
model = create_model()
es_callback = EarlyStoppingCallback(evaluation_fct=lambda x: mean_squared_error(x[1], x[0]), verbose=True)
model.fit(X_train, y_train, eval_set=[(X_train, y_train)], callbacks=[es_callback])
return model

def explain(model, X_test):
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)
return shap_values[0]

def evaluate(model, X_test, y_test):
predictions = model.predict(X_test)
mse = mean_squared_error(y_test, predictions)
r2 = r2_score(y_test, predictions)
return {"mse": mse, "r2": r2}

def main():
X_train, X_test, y_train, y_test = create_dataset()
model = train(X_train, y_train)
shap_values = explain(model, X_test)
results = evaluate(model, X_test, y_test)
print("Explanation Shap Values:", shap_values)
print("Evaluation Results:", results)

if __name__ == "__main__":
main()
