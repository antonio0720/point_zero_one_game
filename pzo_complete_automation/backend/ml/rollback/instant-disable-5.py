if os.path.exists(filepath):
with open(filepath, 'rb') as model_file:
return pickle.load(model_file)
else:
print(f"Error: Model file {filepath} not found.")
return None

def save_model(model: Any, filepath: str):
with open(filepath, 'wb') as model_file:
pickle.dump(model, model_file)

def switch_to_rollback():
global CURRENT_MODEL_FILE, ROLLBACK_MODEL_FILE
CURRENT_MODEL_FILE, ROLLBACK_MODEL_FILE = ROLLBACK_MODEL_FILE, CURRENT_MODEL_FILE

def is_kill_switch_enabled():
return os.path.exists(ROLLBACK_MODEL_FILE)

def disable_kill_switch():
if os.path.exists(ROLLBACK_MODEL_FILE):
os.remove(ROLLBACK_MODEL_FILE)

def load_current_model() -> Optional[Any]:
return load_model(CURRENT_MODEL_FILE)

def save_current_model(model: Any):
save_model(model, CURRENT_MODEL_FILE)

def switch_to_latest_model():
if os.path.exists(ROLLBACK_MODEL_FILE):
os.remove(ROLLBACK_MODEL_FILE)
save_model(load_model(CURRENT_MODEL_FILE), CURRENT_MODEL_FILE)
```
