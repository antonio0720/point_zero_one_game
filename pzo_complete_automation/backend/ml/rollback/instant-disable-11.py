import os
from typing import Union

ML_SERVICE_ENABLED = "ML_SERVICE_ENABLED"
ML_DISABLE_KEY = "instant-disable-11"

def get_ml_service_status() -> bool:
if ML_SERVICE_ENABLED in os.environ:
return os.environ[ML_SERVICE_ENABLED] == "True"
return True

def set_ml_service_status(enabled: Union[bool, str]) -> None:
if enabled is True or enabled == "True":
os.environ[ML_SERVICE_ENABLED] = str(enabled)
elif enabled is False or enabled == "False":
del os.environ[ML_SERVICE_ENABLED]
else:
raise ValueError("Expected boolean value for ML service status.")

def is_ml_service_disabled() -> bool:
if ML_DISABLE_KEY in os.environ:
return os.environ[ML_DISABLE_KEY] == "True"
return False

if __name__ == "__main__":
if is_ml_service_disabled():
print("ML service disabled.")
else:
set_ml_service_status(False)
print("ML service has been instantaneously disabled via kill switch instant-disable-11.")
