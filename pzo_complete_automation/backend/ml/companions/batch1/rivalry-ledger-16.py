import torch
from torch import nn

class LinearLayer(nn.Module):
def __init__(self, input_size, hidden_size, output_size):
super().__init__()
self.fc1 = nn.Linear(input_size, hidden_size)
self.relu = nn.ReLU()
self.fc2 = nn.Linear(hidden_size, output_size)

def forward(self, x):
out = self.fc1(x)
out = self.relu(out)
out = self.fc2(out)
return out

class RivalryLedger(nn.Module):
def __init__(self):
super().__init__()
self.linear_layer1 = LinearLayer(6, 32, 32)
self.linear_layer2 = LinearLayer(32, 16, 2)

def forward(self, x):
out = self.linear_layer1(x)
out = torch.flatten(out, 1)
out = self.linear_layer2(out)
return out
