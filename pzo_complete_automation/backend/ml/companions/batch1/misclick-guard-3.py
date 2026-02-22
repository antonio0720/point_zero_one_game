import os
import time
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
import json
from typing import List

load_dotenv()

app = FastAPI()
API_KEY = os.getenv("API_KEY")
BASE_URL = "https://api.example.com/v1"

class Click(BaseModel):
id: int
timestamp: float
x: float
y: float

def get_click_history(user_id: str) -> List[Click]:
url = f"{BASE_URL}/clicks?user_id={user_id}"
response = requests.get(url, headers={"Authorization": API_KEY})
if response.status_code != 200:
raise HTTPException(status_code=response.status_code, detail="Error fetching click history.")
data = response.json()
return [Click(**click) for click in data]

def check_misclick(clicks: List[Click]) -> bool:
if len(clicks) < 3:
return False

first_click = clicks[0]
second_click = clicks[-2]
third_click = clicks[-1]

distance_between_first_and_second = (first_click.x - second_click.x)**2 + (first_click.y - second_click.y)**2
distance_between_second_and_third = (second_click.x - third_click.x)**2 + (second_click.y - third_click.y)**2

return distance_between_first_and_second > 50 and distance_between_second_and_third < 10

def on_click(user_id: str) -> None:
clicks = get_click_history(user_id)
if check_misclick(clicks):
logging.warning(f"Potential misclick detected for user {user_id}")
url = f"{BASE_URL}/misclicks?user_id={user_id}"
requests.post(url, headers={"Authorization": API_KEY})

@app.on_event("http_request")
async def misclick_guard():
try:
request = www_context["request"]
user_id = request.headers["User-ID"]
except KeyError:
return

if request.method == "CLICK":
on_click(user_id)
