```bash
pip install locust
```

Now, create a new file `load_test.py` and paste the following code:

```python
from locust import HttpUser, task, between

class QuickStartUser(HttpUser):
host = "localhost"  # Your application's base URL here
min_wait_time = int(1000)  # Minimum time between tasks (in milliseconds)
max_wait_time = int(2000)  # Maximum time between tasks (in milliseconds)

@task
def index(self):
self.client.get("/")
```

Adjust the `host` variable to point to your application's base URL. You can add more tasks and test different endpoints by creating new methods annotated with `@task`.

To run the load test, execute:

```bash
locust -f load_test.py --headless --users 10000 --hatch-rate 10
```

This command runs the test with 10,000 users at a hatch rate of 10 users per second (total of 100 requests per second). The `--headless` option prevents the graphical user interface from appearing.
