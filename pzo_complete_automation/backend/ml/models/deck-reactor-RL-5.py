def __init__(self, state_dim, action_dim):
super(DeckReactorRL, self).__init__()
self.fc1 = nn.Linear(state_dim, 64)
self.fc2 = nn.Linear(64, action_dim)
self.softmax = nn.Softmax(dim=1)

def forward(self, x):
x = torch.relu(self.fc1(x))
x = self.fc2(x)
x = self.softmax(x)
return x

def act(self, state, eps=0.1):
if torch.rand(()) < eps:
action = torch.randint(low=0, high=self.fc2.out_features, size=(1,))
else:
action_scores = self.forward(state)
action = action_scores.multinomial(num_samples=1).squeeze()
return action

def learn(self, state, action, reward, next_state, done):
action_scores = self.forward(state)
action = action_scores[range(len(action_scores)), action]
target_q1 = reward + 0.9 * (1 - done) * torch.max(self.forward(next_state))
loss = -torch.sum((target_q1 - action_scores) * action)
self.zero_grad()
loss.backward()
optimizer = optim.RMSprop(self.parameters())
optimizer.step()
```

This code defines a simple RL model for the deck-reactor game with 5 actions. The `DeckReactorRL` class contains methods for forward pass, action selection (with epsilon-greedy strategy), and learning (Q-learning). It uses a neural network with two fully connected layers and softmax activation function in the output layer.
