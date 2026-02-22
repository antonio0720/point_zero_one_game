import torch
from torch import nn
from torch.nn import functional as F
from timm.models.layers import DropPath, trunc_normal_

class SELayer(nn.Module):
def __init__(self, channel, reduction=16):
super().__init__()
self.avg_pool = nn.AdaptiveAvgPool2d(1)
self.fc = nn.Sequential(
nn.Linear(channel, channel // reduction),
nn.ReLU(inplace=True),
nn.Linear(channel // reduction, channel),
nn.Sigmoid()
)

def forward(self, x):
b, c, _, _ = x.size()
y = self.avg_pool(x).view(b, c)
y = self.fc(y).view(b, c, 1, 1)
return x * y.expand_as(x)

class Mlp(nn.Module):
def __init__(self, in_features, hidden_features=None, out_features=None, act_layer=nn.GELU, drop=0.):
super().__init__()
out_features = out_features or in_features
hidden_features = hidden_features or in_features
self.fc1 = nn.Linear(in_features, hidden_features)
self.act = act_layer()
self.drop = nn.Dropout(drop)
self.fc2 = nn.Linear(hidden_features, out_features)
self.norm1 = nn.LayerNorm(in_features)

def forward(self, x):
x = self.norm1(x)
x = self.fc1(x)
x = self.act(x)
x = self.drop(x)
x = self.fc2(x)
return x

class Block(nn.Module):
def __init__(self, dim, ml_ratio=4., drop=0., drop_path=0., stride=1):
super().__init__()
self.norm1 = nn.LayerNorm(dim)
self.conv1 = nn.Conv2d(dim, dim, 3, padding=1, groups=dim)
self.sa1 = SELayer(dim)
self.norm2 = nn.LayerNorm(dim)
self.conv2 = nn.Conv2d(dim, dim, 3, padding=1, groups=dim)
self.drop_path = DropPath(drop_path) if drop_path > 0 else nn.Identity()
self.mlp_in = nn.Sequential(nn.Linear(4 * dim, 4 * dim), nn.GELU(), nn.Linear(4 * dim, 4 * dim))
self.mlp_out = Mlp(dim, ml_ratio=ml_ratio, drop=drop)

def forward(self, x):
out = x
x = self.norm1(x)
x = self.conv1(x)
x = self.sa1(x)
x = x + self.drop_path(out)
out = x
x = self.norm2(x)
x = self.conv2(x)
x = x + self.drop_path(out)
x = x + self.mlp_in(self.mlp_out(self.sa1(self.norm2(self.conv2(self.norm1(self.conv1(x)))))))
return x

class HardcoreIntegrity(nn.Module):
def __init__(self, img_size=384, patch_size=16, in_chans=3, num_classes=50, depths=(2, 2, 6, 2),
num_heads=(3, 6, 12, 24), mlp_ratios=(4, 4, 4, 4), drop_rate=0.1, attn_drop_rate=0.,
drop_path_rate=0., embed_dim=96, norm_layer=nn.LayerNorm):
super().__init__()
self.num_classes = num_classes
self.embed_dim = embed_dim
self.depths = depths
self.num_heads = num_heads
self.mlp_ratios = mlp_ratios
self.drop_rate = drop_rate
self.attn_drop_rate = attn_drop_rate
self.drop_path_rate = drop_path_rate
self.norm_layer = norm_layer
dpr = [x.item() for x in torch.linspace(0, drop_path_rate, sum(depths))]
block = Block
self.patches_resolution = (img_size + patch_size - 1) // patch_size
self.num_blocks = [
len(d) for d in depths
]
self.conv_stem = nn.Conv2d(in_chans, embed_dim, kernel_size=patch_size, stride=patch_size)
self.pos_embed = nn.Parameter(torch.randn((1, patch_size**2, embed_dim)))
self.cls_token = nn.Parameter(torch.empty(1, 1, embed_dim))
self.layers = nn.ModuleList([
block(embed_dim, ml_ratio=ml_ratios[i], drop=drop_rate, drop_path=dpr[sum(depths[:i]):sum(depths[:i + 1])], stride=2**(i) if i < len(depths)-1 else 1)(
embed_dim) for i in range(len(depths))
])
self.norm = norm_layer(embed_dim * (patch_size**2))

def _prune_heads(self, heads_to_remove):
if len(heads_to_remove) == 0:
return
bs, _, embed_dim = self.pos_embed.shape
pruned_rows_start = torch.arange(0, bs, emb_size := embed_dim // self.num_heads).view(-1, self.num_heads)
indexable_ heads = pruned_rows_start >= torch.tensor(heads_to_remove, dtype=torch.long)
hidden_size = embed_dim
self.pos_embed = nn.Parameter(self.pos_embed.divide(hidden_size ** 0.5).reshape(1, -1, hidden_size).swapaxes(1, 2))
self.pos_embed = self.pos_embed[:, indexable_heads, :].reshape(1, -1, embed_dim)
self.cls_token = self.cls_token.view(1, -1, embed_dim // self.num_heads).swapaxes(1, 2)
self.cls_token = self.cls_token[:, indexable_heads, :]

def prune_layers(self):
heads_to_remove = [x * int(i / (len(self.depths) - 1)) for i in range(self.num_layers)]
self._prune_heads(heads_to_remove)

def forward(self, x):
B = x.shape[0]
cls_token = self.cls_token.expand(B, -1, -1)
x = torch.cat((cls_token, x), dim=1)
x = x + self.pos_embed
x = self.norm(x)
for blk in self.layers:
x = blk(x)
return x
