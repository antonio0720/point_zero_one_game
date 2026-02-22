import torch
import torch.nn as nn
import torch.nn.functional as F

class MLP(nn.Module):
def __init__(self, input_dim, hidden_dim, output_dim):
super().__init__()
self.fc1 = nn.Linear(input_dim, hidden_dim)
self.relu = nn.ReLU()
self.dropout = nn.Dropout(0.2)
self.fc2 = nn.Linear(hidden_dim, output_dim)

def forward(self, x):
out = self.fc1(x)
out = self.relu(out)
out = self.dropout(out)
out = self.fc2(out)
return out

class FactionSponsorshipModel(nn.Module):
def __init__(self, input_dim, hidden_dim, output_dim, num_classes):
super().__init__()
self.mlp = MLP(input_dim, hidden_dim, output_dim)
self.fc_out = nn.Linear(output_dim, num_classes)

def forward(self, x):
out = self.mlp(x)
out = self.fc_out(out)
return out
