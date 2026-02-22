import os
import torch
from tensorflow.keras import models
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

def load_model(model_name):
if model_name == "pytorch":
checkpoint = torch.load("path/to/your/pytorch/checkpoint.pt")
model = checkpoint['model']
model.eval()
return model
elif model_name == "tensorflow":
model = models.load_model("path/to/your/tensorflow/checkpoint.h5")
model._make_predict_function()
return model
else:
raise ValueError(f"Unsupported model type '{model_name}'.")

def evaluate(y_true, y_pred, model_type):
if model_type == "pytorch":
y_pred = y_pred.argmax(dim=1).cpu().numpy()
elif model_type == "tensorflow":
y_pred = y_pred.argmax(axis=-1).flatten().astype(int)

acc = accuracy_score(y_true, y_pred)
prf = precision_recall_fscore_support(y_true, y_pred, average='macro')

return {
"accuracy": acc,
"precision": prf[0],
"recall": prf[1],
"f1_score": prf[2]
}

def main():
model = load_model("pytorch")
x_test = ...  # Load your test data here
y_true = ...   # True labels for the test data
y_pred = model(x_test)

result = evaluate(y_true, y_pred, "pytorch")
print(result)

if __name__ == "__main__":
main()
