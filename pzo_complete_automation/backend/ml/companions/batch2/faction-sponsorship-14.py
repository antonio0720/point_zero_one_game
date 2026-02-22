import torch
from sklearn.metrics import accuracy_score
from transformers import AutoTokenizer, AutoModelForSequenceClassification

def load_model(path):
model = AutoModelForSequenceClassification.from_pretrained(path)
tokenizer = AutoTokenizer.from_pretrained(path)
return model, tokenizer

def preprocess(tokenizer, text, max_length=512):
inputs = tokenizer(text, truncation=True, padding='max_length', max_length=max_length)
return torch.tensor([inputs['input_ids']], dtype=torch.long)

def predict(model, tokens):
outputs = model(**tokens)[0]
_, predicted = torch.max(outputs, dim=-1)
return predicted.item()

def evaluate(model, tokenizer, dataset, label_column):
predictions = []
for text in dataset:
input_id = preprocess(tokenizer, text[label_column])[0]
prediction = predict(model, {'input_ids': input_id})
predictions.append(prediction)
return accuracy_score(dataset[:, label_column], predictions)
