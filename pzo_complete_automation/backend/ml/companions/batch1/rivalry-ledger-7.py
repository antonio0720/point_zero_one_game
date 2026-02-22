import torch
from torch import nn

class RivalryLedger(nn.Module):
def __init__(self, num_classes, embedding_dim, hidden_size, num_layers):
super().__init__()

self.embedding = nn.Embedding(num_emb=num_classes, embedding_dim=embedding_dim)
self.gru = nn.GRU(input_size=embedding_dim, hidden_size=hidden_size, num_layers=num_layers, batch_first=True)
self.fc = nn.Linear(in_features=hidden_size, out_features=num_classes)
self.dropout = nn.Dropout(p=0.2)

def forward(self, x):
embedded = self.embedding(x)
output, hidden = self.gru(embedded)
output = self.dropout(output[:, -1, :])
output = self.fc(output)
return output
