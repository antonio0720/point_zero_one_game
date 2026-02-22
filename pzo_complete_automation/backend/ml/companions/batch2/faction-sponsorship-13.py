import torch
import torch.nn as nn
import torch.nn.functional as F

class MLP(nn.Module):
def __init__(self, input_dim, hidden_dim, output_dim):
super().__init__()
self.fc1 = nn.Linear(input_dim, hidden_dim)
self.act = nn.ReLU()
self.fc2 = nn.Linear(hidden_dim, output_dim)

def forward(self, x):
out = self.fc1(x)
out = self.act(out)
out = self.fc2(out)
return out

def initialize_weights(m):
if type(m) == nn.Linear:
torch.nn.init.xavier_normal_(m.weight)
m.bias.data.zero_()

def train(model, device, train_loader, optimizer, epochs=10):
model.train()
for epoch in range(epochs):
running_loss = 0.0
for i, data in enumerate(train_loader, 0):
inputs, labels = data[0].to(device), data[1].to(device)
optimizer.zero_grad()
outputs = model(inputs)
loss = F.cross_entropy(outputs, labels)
loss.backward()
optimizer.step()
running_loss += loss.item()
print('Epoch %d, Loss: %.3f' % (epoch + 1, running_loss / len(train_loader)))

def test(model, device, test_loader):
model.eval()
correct = 0
total = 0
with torch.no_grad():
for data in test_loader:
inputs, labels = data[0].to(device), data[1].to(device)
outputs = model(inputs)
_, predicted = torch.max(outputs.data, 1)
total += labels.size(0)
correct += (predicted == labels).sum().item()
print('Accuracy of the network on the test images: %.2f %%' % (100 * correct / total))
