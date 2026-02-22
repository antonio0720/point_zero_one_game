def __init__(self, input_size, output_size, hidden_size=400):
super().__init__()
self.fc1 = nn.Linear(input_size, hidden_size)
self.relu = nn.ReLU()
self.fc2 = nn.Linear(hidden_size, output_size)
self.softmax = nn.Softmax(dim=1)

def forward(self, x):
out = self.fc1(x)
out = self.relu(out)
out = self.fc2(out)
out = self.softmax(out)
return out

class DeckReactorDQNAgent:
def __init__(self, q_model, learning_rate=0.001, reward_decay=0.95, e_greedy=0.9, buffer_size=50000):
self.q_model = q_model
self.lr = learning_rate
self.gamma = reward_decay
self.epsilon_max = e_greedy
self.epsilon_min = 0.1
self.epsilon_decay = 0.995
self.buffer = []
self.max_buffer = buffer_size
self.train_step_at_least = 200

def choose_action(self, x):
if np.random.uniform() < self.epsilon:
return np.argmax(self.q_model(x))
else:
return np.random.choice(4)

def learn(self):
if len(self.buffer) < self.max_buffer:
return
transitions = zip(*self.buffer)
input_batch, output_batch, next_input_batch, rewards, done_mask = map(torch.cat, zip(*transitions))

q_pred = self.q_model(input_batch).gather(1, output_batch.unsqueeze(1)).squeeze(1)
max_next_q = self.q_model(next_input_batch).detach().max(1)[0]
q_target = rewards + (1 - done_mask) * self.gamma * max_next_q
loss = torch.mean((q_pred - q_target)**2)

self.q_model.zero_grad()
loss.backward()
self.q_model.optimizer.step()

self.epsilon -= (self.epsilon_max - self.epsilon_min) * (self.train_step_at_least ** (-0.5))

def reset(self):
self.buffer = []
```
