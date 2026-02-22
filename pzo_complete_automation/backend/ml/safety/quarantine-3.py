def __init__(self, quarantine_folder: str = 'quarantined'):
self.quarantine_folder = quarantine_folder
os.makedirs(self.quarantine_folder, exist_ok=True)

def quarantine_model(self, model_name: str):
if not self.is_model_quarantined(model_name):
model_path = f'models/{model_name}.pkl'
shutil.move(model_path, f'{self.quarantine_folder}/{model_name}.pkl')
print(f'Model {model_name} quarantined.')
else:
print(f'Model {model_name} is already quarantined.')

def dequarantine_model(self, model_name: str):
model_path = f'{self.quarantine_folder}/{model_name}.pkl'
if os.path.exists(model_path):
shutil.move(model_path, f'models/{model_name}.pkl')
print(f'Model {model_name} dequarantined.')
else:
print(f'Model {model_name} is not quarantined.')

def is_model_quarantined(self, model_name: str) -> bool:
return os.path.exists(f'{self.quarantine_folder}/{model_name}.pkl')

quarantine = QuarantineSystem()
# Usage examples:
# quarantine.quarantine_model('my_model')
# quarantine.dequarantine_model('my_model')
```
