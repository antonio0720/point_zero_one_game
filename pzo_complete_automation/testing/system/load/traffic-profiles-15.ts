```javascript
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

app.use(bodyParser.json());

// Your API routes here
app.get('/', (req, res) => {
res.send('Hello World!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
```

To run Chaos Monkey and JMeter tests, you'll need to create separate scripts for each:

1. Chaos Monkey (e.g., `chaos-monkey.sh`):

```bash
#!/bin/bash

CHAOS_MONKEY_FILE="path/to/chaos-monkey"

$CHAOS_MONKEY_FILE --aws --regions us-east-1,us-west-2,eu-central-1 --min-agents 1 --max-agents 3 --instance-type t2.micro
```

2. JMeter test plan (e.g., `test-plan.jmx`):

You can create a test plan using the JMeter GUI and save it as an .jmx file. This file contains all the configuration for your load test, such as the number of threads, ramp-up time, and HTTP request details.

3. Run JMeter from the command line (e.g., `run-test.sh`):

```bash
#!/bin/bash

JMETER_HOME="path/to/jmeter"
TEST_PLAN="path/to/test-plan.jmx"

$JMETER_HOME/bin/jmeter -n -t $TEST_PLAN -l results.jtl -e -o report
```
