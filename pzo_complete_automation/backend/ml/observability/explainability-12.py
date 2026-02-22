import os
import shap
import joblib
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from sklearn.ensemble import RandomForestRegressor
from shap.summary_plots import bar, scatter_matrix, violin_plot

app = Flask(__name__)
model = None
shap_values = {}

def load_model():
global model, shap_values
if not os.path.exists('models/model.pkl'):
model = RandomForestRegressor()
else:
model = joblib.load('models/model.pkl')
shap_values = joblib.load('models/shap_values.pkl')

def save_model():
joblib.dump(model, 'models/model.pkl')
joblib.dump(shap_values, 'models/shap_values.pkl')

@app.route('/train', methods=['POST'])
def train():
data = request.get_json()
X_train = pd.DataFrame(data['X_train'])
y_train = np.array(data['y_train'])

load_model()
model.fit(X_train, y_train)
save_model()

explainer = shap.TreeExplainer(model)
shap_values['train'] = explainer.shap_values(X_train)

return jsonify({'status': 'success'})

@app.route('/predict', methods=['POST'])
def predict():
data = request.get_json()
X_test = pd.DataFrame(data['X_test'])

load_model()
predictions = model.predict(X_test)

explainer = shap.TreeExplainer(model)
shap_values_test = explainer.shap_values(X_test)

result = {
'predictions': predictions.tolist(),
'bar': bar(shap_values['train'], X_train),
'scatter': scatter_matrix(shap_values['train'], X_train),
'violin': violin_plot(shap_values['train'], X_train)
}

return jsonify(result)

if __name__ == "__main__":
app.run(debug=True)
