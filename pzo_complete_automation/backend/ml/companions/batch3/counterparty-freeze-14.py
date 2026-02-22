import torch
from torch import nn
from sklearn.metrics import accuracy_score

class CounterpartyFreezeModel(nn.Module):
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

def train(model, device, train_loader, optimizer, epochs=10):
model.train()
for epoch in range(epochs):
running_loss = 0.0
for i, data in enumerate(train_loader):
inputs, labels = data[0].to(device), data[1].to(device)
optimizer.zero_grad()
outputs = model(inputs)
loss = nn.CrossEntropyLoss()(outputs, labels)
loss.backward()
optimizer.step()
running_loss += loss.item()
print(f"Epoch {epoch + 1}, Loss: {running_loss / (i + 1)}")

def evaluate(model, device, test_loader):
model.eval()
y_pred = []
y_true = []

with torch.no_grad():
for data in test_loader:
inputs, labels = data[0].to(device), data[1].to(device)
outputs = model(inputs)
_, predicted = torch.max(outputs.data, 1)
y_pred.extend(predicted.cpu().numpy())
y_true.extend(labels.cpu().numpy())
return y_pred, y_true

def main():
# Initialize device (CPU or GPU)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Hyperparameters
input_dim = 784  # MNIST image flattened to 1D (28*28)
hidden_dim = 512
output_dim = 10  # Number of classes in MNIST dataset

# Load and normalize the data
train_data, test_data = torch.utils.tensorflow.datasets.mnist.load_data(one_hot=True)
train_data, test_data = torch.FloatTensor(train_data / 255.0), torch.FloatTensor(test_data / 255.0)

# Create data loaders for training and testing with batch size 64
train_loader = torch.utils.data.DataLoader(train_data, batch_size=64, shuffle=True)
test_loader = torch.utils.data.DataLoader(test_data, batch_size=64, shuffle=False)

# Initialize the model and optimizer
model = CounterpartyFreezeModel(input_dim, hidden_dim, output_dim).to(device)
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

train(model, device, train_loader, optimizer)

# Evaluate the model on test data
y_pred, y_true = evaluate(model, device, test_loader)

print("Accuracy:", accuracy_score(y_true, y_pred))

if __name__ == "__main__":
main()
