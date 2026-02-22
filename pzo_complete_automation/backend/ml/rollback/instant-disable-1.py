# Your code to disable the ML model goes here
pass

@app.route('/rollback/instant-disable', methods=['POST'])
def rollback():
data = request.get_json()

if data and 'action' in data:
action = data['action']

if action == 'disable':
instant_disable()
return jsonify({'status': 'Successfully disabled the model.'}), 200
elif action == 'enable':
# Your code to enable the ML model goes here
pass
return jsonify({'status': 'Model already enabled.'}), 200
else:
return jsonify({'error': 'Invalid request.'}), 400

if __name__ == "__main__":
app.run(debug=True)
```

This script provides an endpoint `/rollback/instant-disable` that accepts POST requests with JSON data containing the action to be performed: 'disable' or 'enable'. The function `instant_disable()` should contain your code for disabling the ML model when the endpoint is called.
