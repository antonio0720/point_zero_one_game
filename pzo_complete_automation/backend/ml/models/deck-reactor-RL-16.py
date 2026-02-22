import torch
import torch.nn as nn
import torch.optim as optim

class DQNN(nn.Module):
def __init__(self, input_size, hidden_layer_size, output_size):
super().__init__()
self.fc1 = nn.Linear(input_size, hidden_layer_size)
self.relu = nn.ReLU()
self.fc2 = nn.Linear(hidden_layer_size, output_size)

def forward(self, x):
x = self.fc1(x)
x = self.relu(x)
x = self.fc2(x)
return x

class DQN:
def __init__(self, state_size, action_size, learning_rate=0.001, discount_factor=0.9, epsilon=1.0, epsilon_min=0.1, epsilon_decay=40000):
self.state_size = state_size
self.action_size = action_size
self.learning_rate = learning_rate
self.discount_factor = discount_factor
self.epsilon = epsilon
self.epsilon_min = epsilon_min
self.epsilon_decay = epsilon_decay
self.q_network = DQNN(state_size, 256, action_size).to('cpu')
self.target_q_network = DQNN(state_size, 256, action_size).to('cpu')
self.optimizer = optim.Adam(self.q_network.parameters(), lr=learning_rate)
self.loss_func = nn.MSELoss()

def select_action(self, state):
if np.random.rand() < self.epsilon:
action = np.random.choice(self.action_size)
else:
state0 = torch.from_numpy(state).float().unsqueeze(0).to('cpu')
q_values = self.q_network(state0)
action = np.argmax(q_values.data.numpy())
return action, self.epsilon

def experience_replay(self, state, action, reward, next_state, done):
target_q_value = reward
if not done:
q_next_state = self.target_q_network(torch.from_numpy(next_state).float().unsqueeze(0).to('cpu'))
max_future_q_value = torch.max(q_next_state, 1)[0].cpu().data.numpy()
target_q_value = (self.discount_factor * max_future_q_value[action]) + reward
q_state = self.q_network(torch.from_numpy(state).float().unsqueeze(0).to('cpu'))
q_values = q_state.gather(1, torch.tensor([action], dtype=torch.long))
loss = self.loss_func(q_values, target_q_value)
self.optimizer.zero_grad()
loss.backward()
self.optimizer.step()

def learn(self):
self.epsilon -= (self.epsilon - self.epsilon_min) / self.epsilon_decay
if np.random.rand() < 0.5:
self.target_q_network.load_state_dict(self.q_network.state_dict())
