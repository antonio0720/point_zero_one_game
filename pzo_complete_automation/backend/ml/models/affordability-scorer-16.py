from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
from joblib import load

app = FastAPI()

model = load("affordability_scorer_16.joblib")

class PredictionRequest(BaseModel):
features: list

@app.post("/predict/")
def predict(request: PredictionRequest):
input_data = pd.DataFrame([request.features])
prediction = model.predict_proba(input_data)[:, 1]

if prediction[0] < 0.5:
return {"affordable": False}
else:
return {"affordable": True}

@app.get("/metrics/")
def metrics():
X_test = ... # load your test dataset for model evaluation
y_pred_proba = model.predict_proba(X_test)[:, 1]

accuracy = accuracy_score(X_test.pop("target"), (y_pred_proba > 0.5).astype(int))
auc = roc_auc_score(X_test["target"], y_pred_proba)

return {"accuracy": accuracy, "auroc": auc}
