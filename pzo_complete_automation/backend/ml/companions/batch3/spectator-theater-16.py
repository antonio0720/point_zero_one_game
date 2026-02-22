import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import AutoModel, AutoTokenizer

model_name = 'google/bigscience-finetuned-roberta-base-sqsh'
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModel.from_pretrained(model_name)

def add_special_tokens(text):
inputs = tokenizer.encode(text, add_special_tokens=True)
return inputs

def forward(inputs):
input_ids = torch.tensor([inputs]).long().to('cuda')
with torch.no_grad():
outputs = model(input_ids)
last_hidden_state = outputs[0]
attention_output = last_hidden_state[:, 0, :]
attention_scores = F.log_softmax(attention_output, dim=-1)
return attention_scores.squeeze(1)
