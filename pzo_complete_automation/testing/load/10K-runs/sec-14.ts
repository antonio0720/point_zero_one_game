from locust import TaskSet, task, events
import time

class UserBehavior(TaskSet):
@task
def my_task(self):
for _ in range(10000):  # Run the task 10K times per user
self.client.get("/")  # Replace "/" with your application's route
time.sleep(1 / 14)  # Adjust the sleep interval to achieve the desired load (1/14 means 14 requests per second per user)

@task
def chaos_injector(self):
events.LocustStartEvent.send(user=self)
while True:
self.client.post("/chaos-event", {"event": "random_failure"})  # Replace "/chaos-event" with your application's route to inject chaos
time.sleep(15)  # Adjust the interval as needed to simulate failures randomly

class LoadTestUser(locust.User):
task_set = UserBehavior
min_wait = 2000
max_wait = 4000

def on_locuststart(**kwargs):
print("Load test has started.")

def on_locustshutdown(**kwargs):
print("Load test has finished.")

events.LocustStartEvent += on_locuststart
events.LocustShutdownEvent += on_locustshutdown
