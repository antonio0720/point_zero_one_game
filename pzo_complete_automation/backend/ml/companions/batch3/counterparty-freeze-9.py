import torch
from torch import nn
from sklearn.metrics import accuracy_score, precision_recall_fscore_support as prfs
from transformers import AutoModelForSequenceClassification, AutoTokenizer

class CounterpartyFreeze9(nn.Module):
def __init__(self, config):
super().__init__()
self.model = AutoModelForSequenceClassification.from_pretrained(config.model)
self.tokenizer = AutoTokenizer.from_pretrained(config.model)
self.num_labels = config.num_labels

def forward(self, inputs):
input_ids = inputs['input_ids']
attention_mask = inputs['attention_mask']
labels = inputs['labels'] if 'labels' in inputs else None
outputs = self.model(input_ids, attention_mask=attention_mask)
loss = outputs.loss if labels is not None else None
logits = outputs.logits
predictions = torch.argmax(logits, dim=-1)
return {'predictions': predictions, 'loss': loss}

def compute_metrics(self, eval_pred):
predictions = eval_pred[0]
labels = eval_pred[1]
predictions = np.argmax(predictions, axis=1)
precision, recall, f1, _ = prfs(labels, predictions, average='weighted')
accuracy = accuracy_score(labels, predictions)
return {'accuracy': accuracy, 'precision': precision, 'recall': recall, 'f1': f1}
