import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

class RivalryLedger9Dataset(Dataset):
def __init__(self, data, target):
self.data = data
self.target = target
self.length = len(data)

def __getitem__(self, index):
return self.data[index], self.target[index]

def __len__(self):
return self.length

class RivalryLedger9Model(nn.Module):
def __init__(self, input_dim, hidden_dim, output_dim):
super(RivalryLedger9Model, self).__init__()
self.fc1 = nn.Linear(input_dim, hidden_dim)
self.relu = nn.ReLU()
self.fc2 = nn.Linear(hidden_dim, output_dim)

def forward(self, x):
out = self.fc1(x)
out = self.relu(out)
out = self.fc2(out)
return out

def train(model, criterion, optimizer, dataloader):
model.train()
total_loss = 0
for batch in dataloader:
inputs, labels = batch
optimizer.zero_grad()
outputs = model(inputs)
loss = criterion(outputs, labels)
loss.backward()
optimizer.step()
total_loss += loss.item()
return total_loss / len(dataloader)

def test(model, criterion, dataloader):
model.eval()
total_loss = 0
with torch.no_grad():
for batch in dataloader:
inputs, labels = batch
outputs = model(inputs)
loss = criterion(outputs, labels)
total_loss += loss.item()
return total_loss / len(dataloader)
