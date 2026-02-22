import pandas as pd
from sklearn.datasets import load_iris
from sklearn.ensemble import RandomForestClassifier
from libra_mlops import ModelArtifact, Experiment, ContinuousLearningExperiment
from shap import TreeExplainer, DependentTreeExplainer

# Load data and create a train/test split
iris = load_iris(as_frame=True)
X = iris.data
y = iris.target
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Train a RandomForestClassifier
model = RandomForestClassifier()
model.fit(X_train, y_train)

# Initialize ContinuousLearningExperiment
experiment = ContinuousLearningExperiment("explainability-2")
experiment.set_experiment_context("training", model)

# Save the initial model as an artifact
model_artifact = ModelArtifact(name="baseline", version=1, model=model)
experiment.save(model_artifact)

# Create a DependentTreeExplainer for interpretability
explainer = DependentTreeExplainer(model)

# Define a function to update the model and save the SHAP values
def update_and_explain(X_new, y_new):
model.fit(X_new, y_new)
shap_values = explainer.shap_values(X_new)
# Save SHAP values as an artifact
shap_artifact = ModelArtifact(name="shap", version=1, data=pd.DataFrame(shap_values))
experiment.save(shap_artifact)

# Update the model and save the SHAP values on new data
update_and_explain(X_test, y_test)
