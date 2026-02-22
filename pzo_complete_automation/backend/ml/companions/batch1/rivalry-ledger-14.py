import torch
from torch import nn
from torch.nn import functional as F
from sklearn.metrics import accuracy_score, confusion_matrix
import numpy as np

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

class RivalryLedger(nn.Module):
def __init__(self, input_size, hidden_size, output_size, num_layers=2):
super(RivalryLedger, self).__init__()
self.hidden_size = hidden_size
self.num_layers = num_layers
self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
self.fc = nn.Linear(hidden_size, output_size)

def forward(self, x):
h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(device)
c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(device)
out, _ = self.lstm(x, (h0, c0))
out = self.fc(out[:, -1, :])
return F.log_softmax(out, dim=1)

def train(model, dataset, optimizer, criterion, epochs):
model.train()
running_loss = 0.0
for i, data in enumerate(dataset):
inputs, labels = data[0].to(device), data[1].to(device)
optimizer.zero_grad()
outputs = model(inputs)
loss = criterion(outputs, labels)
loss.backward()
optimizer.step()
running_loss += loss.item()
if i % 1000 == 999:
print("Epoch [{}/{}], Step [{}/{}], Loss: {:.4f}".format(epochs, epochs, i+1, len(dataset), running_loss / (i+1)))
running_loss = 0.0
print("Training Complete.")

def evaluate(model, dataset):
model.eval()
predictions = []
labels = []
with torch.no_grad():
for data in dataset:
inputs, labels = data[0].to(device), data[1].to(device)
outputs = model(inputs)
_, predicted = torch.max(outputs.data, 1)
predictions.extend(predicted.cpu().numpy())
labels.extend(labels.cpu().numpy())
return np.array(predictions), np.array(labels)

def main():
# Load your data here. Assume it's already preprocessed.
input_size = ...
hidden_size = ...
output_size = ...
num_epochs = ...
batch_size = ...
learning_rate = ...

dataset = ...  # load your dataset here
dataloader = torch.utils.data.DataLoader(dataset, batch_size=batch_size, shuffle=True)

model = RivalryLedger(input_size, hidden_size, output_size).to(device)
criterion = nn.NLLLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

train(model, dataloader, optimizer, criterion, num_epochs)

if __name__ == "__main__":
main()
