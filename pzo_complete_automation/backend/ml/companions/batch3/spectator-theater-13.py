import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

class ActorCritic(nn.Module):
def __init__(self, state_dim, action_dim, max_action):
super().__init__()
self.state_dim = state_dim
self.action_dim = action_dim
self.max_action = max_action

self.actor = nn.Sequential(
nn.Linear(self.state_dim, 64),
nn.ReLU(),
nn.Linear(64, self.action_dim * 2)
)

self.critic = nn.Sequential(
nn.Linear(self.state_dim, 64),
nn.ReLU(),
nn.Linear(64, 1)
)

def forward(self, state):
action = torch.split(self.actor(state), self.action_dim, dim=1)
action = torch.cat([torch.tanh(a) * self.max_action for a in action], dim=-1)

q_value = self.critic(state)
return action, q_value

def compute_loss(actor_critic, state, action, reward, next_state, done):
actor_loss = -(reward + done * 0.01 * (actor_critic.max_action ** 2)).mean()
q_value = actor_critic(next_state)
critic_loss = ((reward + (1 - done) * q_value).detach() - actor_critic(state)).pow(2).mean()

return actor_loss, critic_loss

def main():
state_dim = 4
action_dim = 2
max_action = 1.0
buffer_size = 10000
batch_size = 64
gamma = 0.99
lr_actor = 0.0003
lr_critic = 0.001

state_tensor = torch.rand((buffer_size, state_dim))
action_tensor = torch.rand((buffer_size, action_dim))
reward_tensor = torch.rand((buffer_size,))
next_state_tensor = torch.rand((buffer_size, state_dim))
done_tensor = torch.zeros((buffer_size,), dtype=torch.uint8)

dataset = TensorDataset(state_tensor, action_tensor, reward_tensor, next_state_tensor, done_tensor)
dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

actor_critic = ActorCritic(state_dim, action_dim, max_action).to('cpu')
optimizer_actor = optim.Adam(actor_critic.actor.parameters(), lr=lr_actor)
optimizer_critic = optim.Adam(actor_critic.critic.parameters(), lr=lr_critic)

for epoch in range(1000):
for state, action, reward, next_state, done in dataloader:
state, action, reward, next_state, done = map(lambda x: x.to('cpu'), (state, action, reward, next_state, done))

optimizer_actor.zero_grad()
optimizer_critic.zero_grad()

actor_action, critic_q_value = actor_critic(state)
loss_actor, loss_critic = compute_loss(actor_critic, state, action, reward, next_state, done)

loss_total = loss_actor + loss_critic
loss_total.backward()
optimizer_actor.step()
optimizer_critic.step()

print(f'Epoch {epoch+1}, Loss Actor: {loss_actor.item():.4f}, Loss Critic: {loss_critic.item():.4f}')

if __name__ == '__main__':
main()
