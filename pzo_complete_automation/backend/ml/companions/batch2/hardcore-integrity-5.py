import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models

class HardcoreIntegrity(nn.Module):
def __init__(self, num_classes=1000):
super().__init__()
self.resnet50 = models.resnet50(pretrained=True)
num_ftrs = self.resnet50.fc.in_features
self.resnet50.fc = nn.Sequential(
nn.Linear(num_ftrs, 256),
nn.ReLU(inplace=True),
nn.Dropout(),
nn.Linear(256, num_classes)
)

def forward(self, x):
x = self.resnet50(x)
return F.normalize(x, dim=1)
