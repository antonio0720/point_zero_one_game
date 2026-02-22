import torch
import torch.nn as nn
import torch.nn.functional as F
from einops import rearrange, repeat

class PositionalEncoding(nn.Module):
def __init__(self, d_model, dropout=0.1, max_len=5000):
super().__init__()
self.dropout = nn.Dropout(p=dropout)

pe = torch.zeros((max_len, d_model))
position = torch.arange(0, max_len).unsqueeze(1).float()
div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-torch.log(torch.tensor(10000.0)) / d_model))
pe[:, 0::2] = torch.sin(position * div_term)
pe[:, 1::2] = torch.cos(position * div_term)
pe = pe.unsqueeze(0).transpose(0, 1)
self.register_buffer('pe', pe)

def forward(self, x):
x = x + self.pe[:x.size(1), :]
return self.dropout(x)

class SpectatorTheater(nn.Module):
def __init__(self, d_model, num_heads, dim_feedforward, dropout=0.1):
super().__init__()
inner_dim = dim_feedforward // 2
self.embedding = nn.Embedding(num_entities, d_model)
self.pos_encoder = PositionalEncoding(d_model)
self.encoders = nn.TransformerEncoder(nn.TransformerEncoderLayer(d_model, nhead=num_heads, dropout=dropout))
self.decoder = nn.Linear(d_model, num_entities)

def forward(self, entities, positions):
x = self.embedding(entities)
x = self.pos_encoder(x + positions)
x = self.encoders(x)
output = self.decoder(x[:, 0])
return output
