import torch
from torch import nn
from torch.nn import functional as F

class Actor(nn.Module):
def __init__(self, input_dim, hidden_dim, action_dim):
super().__init__()
self.fc1 = nn.Linear(input_dim, hidden_dim)
self.fc2 = nn.Linear(hidden_dim, hidden_dim)
self.fc3 = nn.Linear(hidden_dim, action_dim)
self.softmax = nn.Softmax(dim=1)

def forward(self, x):
x = F.relu(self.fc1(x))
x = F.relu(self.fc2(x))
x = torch.tanh(self.fc3(x))
return self.softmax(x)

class Critic(nn.Module):
def __init__(self, input_dim, hidden_dim):
super().__init__()
self.fc1 = nn.Linear(input_dim*2, hidden_dim)
self.fc2 = nn.Linear(hidden_dim, 1)

def forward(self, state, action):
q_value = torch.cat([state, action], dim=1)
q_value = F.relu(self.fc1(q_value))
q_value = self.fc2(q_value)
return q_value

class DDPGAgent:
def __init__(self, input_dim, hidden_dim, action_dim):
self.actor = Actor(input_dim, hidden_dim, action_dim)
self.critic = Critic(input_dim*2, hidden_dim)
self.optimizer_actor = torch.optim.Adam(self.actor.parameters(), lr=0.001)
self.optimizer_critic = torch.optim.Adam(self.critic.parameters(), lr=0.001)

def act(self, state):
action = self.actor(state).detach()
return action

def learn(self, states, actions, rewards, next_states, dones):
# Update critic
target_q_values = self.critic(next_states, self.actor(next_states)).detach()
target_q_values[dones] = 0
q_values = self.critic(states, actions)
loss_critic = F.mse_loss(target_q_values, q_values)
self.optimizer_critic.zero_grad()
loss_critic.backward()
self.optimizer_critic.step()

# Update actor
actor_loss = -self.critic(states, self.actor(states)).mean()
self.optimizer_actor.zero_grad()
actor_loss.backward()
self.optimizer_actor.step()
