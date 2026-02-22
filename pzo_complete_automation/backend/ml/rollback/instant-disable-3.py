import os
import json
from typing import Dict, Union

class KillSwitch:
def __init__(self, kill_switch_file: str):
self.kill_switch_file = kill_switch_file

def is_enabled(self) -> bool:
with open(self.kill_switch_file, "r") as file:
state = json.load(file)
return state["enabled"]

def toggle(self):
with open(self.kill_switch_file, "r+") as file:
data = json.load(file)
data["enabled"] = not data["enabled"]
file.seek(0)
json.dump(data, file)

def rollback(model_path: str, kill_switch: KillSwitch):
if kill_switch.is_enabled():
os.remove(model_path)
print("Model rolled back due to enabled kill switch.")
else:
print("Model not rolled back as the kill switch is disabled.")
