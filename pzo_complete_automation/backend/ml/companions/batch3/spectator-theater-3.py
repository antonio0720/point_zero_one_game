import torch
import torch.nn as nn
import torch.nn.functional as F

class SpectatorTheater3(nn.Module):
def __init__(self, input_dim, hidden_dim, num_classes):
super().__init__()
self.fc1 = nn.Linear(input_dim, hidden_dim)
self.act = nn.ReLU()
self.dropout = nn.Dropout(0.2)
self.fc2 = nn.Linear(hidden_dim, num_classes)

def forward(self, x):
x = self.fc1(x)
x = self.act(x)
x = self.dropout(x)
x = self.fc2(x)
return F.log_softmax(x, dim=1)
