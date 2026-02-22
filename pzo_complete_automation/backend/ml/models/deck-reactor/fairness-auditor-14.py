import torch
import torch.nn as nn
from sklearn.metrics import fairness_measures
from typing import Dict, List, Tuple

class FairnessAuditor(nn.Module):
def __init__(self, base_model: nn.Module, protected_attribute_index: int = -1):
super().__init__()
self.base_model = base_model
self.protected_attribute_index = protected_attribute_index

def forward(self, input_data: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
predictions, outputs = self.base_model(input_data)
protected_feature = input_data[:, self.protected_attribute_index]
return predictions, protected_feature

def compute_fairness_metrics(self, predictions: torch.Tensor, true_labels: torch.Tensor, protected_features: torch.Tensor):
fairness_scores = {}
grouped_predictions = torch.index_select(predictions, dim=0, index=protected_features)
grouped_true_labels = torch.index_select(true_labels, dim=0, index=protected_features)

for group in ["demographic_parity", "equalized_odds"]:
metric = getattr(fairness_measures, f"mean_{group}_error")
fairness_scores[group] = metric(grouped_predictions.cpu().numpy(), grouped_true_labels.cpu().numpy())

return fairness_scores

def evaluate(self, dataset: torch.utils.data.Dataset) -> Dict[str, float]:
data_loader = torch.utils.data.DataLoader(dataset, batch_size=64, shuffle=True)
fairness_scores = {}

for batch in data_loader:
inputs, labels = batch
predictions, protected_features = self.forward(inputs)
fairness_scores.update(self.compute_fairness_metrics(predictions, labels, protected_features))

return {key: sum(value[key]) for key, value in fairness_scores.items()}
