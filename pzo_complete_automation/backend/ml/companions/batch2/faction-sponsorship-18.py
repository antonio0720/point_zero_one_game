from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import pandas as pd
import numpy as np

def faction_sponsorship(X_train, y_train, X_test):
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)

mse = mean_squared_error(y_test=y_test, y_pred=y_pred)
r2 = r2_score(y_test=y_test, y_pred=y_pred)

return model, mse, r2
