def __init__(self, state_dim, action_dim, max_memory=1000):
self.state_dim = state_dim
self.action_dim = action_dim
self.max_memory = max_memory
self.memory = np.zeros((self.max_memory, self.state_dim * 4 + 2))
self.pos = 0
self.epsilon = 1.0
self.epsilon_decay = 0.9995
self.epsilon_min = 0.01
self.gamma = 0.99
self.reward_scale = 1.0
self.model = self._build_model()
self.target_model = self._build_model()
self.loss_func = nn.SmoothL1Loss()
self.optimizer = optim.Adam(self.model.parameters(), lr=0.001)

def _build_model(self):
input = torch.tensor(np.zeros((1, self.state_dim * 4 + 2)))
conv1 = nn.Sequential(
nn.Conv2d(in_channels=1, out_channels=32, kernel_size=(8, 8)),
nn.ReLU(),
nn.MaxPool2d((2, 2))
)
conv2 = nn.Sequential(
nn.Conv2d(in_channels=32, out_channels=64, kernel_size=(4, 4)),
nn.ReLU(),
nn.MaxPool2d((2, 2))
)
conv3 = nn.Sequential(
nn.Conv2d(in_channels=64, out_channels=64, kernel_size=(3, 3)),
nn.ReLU()
)
fc1 = nn.Linear(64 * np.prod((3, 3)) + 2, 512)
fc2 = nn.Linear(512, self.action_dim)

return nn.Sequential(
input,
conv1, conv2, conv3,
nn.Flatten(),
fc1,
nn.ReLU(),
fc2
)

def remember(self, state, action, reward, next_state, done):
self.memory[self.pos] = [np.flatten(state), action, reward, np.flatten(next_state), done]
self.pos = (self.pos + 1) % self.max_memory

def choose_action(self, state):
if np.random.uniform() < self.epsilon:
return np.random.choice(self.action_dim)
else:
state0 = torch.from_numpy(np.expand_dims(state, axis=0)).float().unsqueeze(1)
q_values = self.model(state0)
actions_q_values = q_values[0].cpu().detach().numpy()
action = np.argmax(actions_q_values)
return action

def learn(self):
if len(self.memory) < self.max_memory or self.epsilon > self.epsilon_min:
return

batch_size = min(len(self.memory), 32)
experiences = np.random.choice(self.max_memory, batch_size, replace=False)
states_batch = [self.memory[i][0] for i in experiences]
actions_batch = [self.memory[i][1] for i in experiences]
rewards_batch = [self.memory[i][2] for i in experiences]
next_states_batch = [self.memory[i][3] for i in experiences]
dones_batch = [self.memory[i][4] for i in experiences]

q_values_batch = []
max_future_q_values_batch = []
states_batch_tensor = torch.from_numpy(np.stack(states_batch)).float()
next_states_batch_tensor = torch.from_numpy(np.stack(next_states_batch)).float()

for i in experiences:
state = self.memory[i][0]
next_state = self.memory[i][3]
done = self.memory[i][4]

max_future_q_values, _ = self.target_model(torch.from_numpy(np.expand_dims(next_state, axis=0)).float().unsqueeze(1))
max_future_q_values = max_future_q_values[0].cpu().detach().numpy()
max_future_q_values_batch.append(max_future_q_values)

max_future_q_values_batch = np.stack(max_future_q_values_batch)

q_values = self.model(states_batch_tensor)
q_values_batch.append(q_values[0].cpu().detach().numpy())

loss = 0
for i in range(batch_size):
q_value = q_values_batch[i][actions_batch[i]]
max_future_q_value = max_future_q_values_batch[i]
reward = rewards_batch[i] * self.reward_scale
if done[i]:
target_q_value = reward
else:
target_q_value = reward + self.gamma * max_future_q_value
loss += self.loss_func(q_value, torch.tensor([target_q_value]))
loss /= batch_size
self.optimizer.zero_grad()
loss.backward()
self.optimizer.step()
self.epsilon *= self.epsilon_decay
```
