global rollback, kill_switch

if kill_switch:
data = request.get_json()
prediction = model.predict(data)

# Simulate production workload here
time.sleep(1)

return jsonify({'prediction': prediction})
else:
if not rollback:
rollback = True
print("Rolling back to previous version of the model...")
os.system('mv old_model.pkl your_model.pkl')
return jsonify({'prediction': model.predict(request.get_json())})

if __name__ == '__main__':
app.run()
```

In this example:

- The `kill_switch` variable is used as a global "on/off" switch for the ML model.
- When `kill_switch` is set to True, the model will run and make predictions as usual.
- When `kill_switch` is set to False, the system rolls back to an old version of the model (assuming you have an 'old_model.pkl' stored).
- The rollback happens only once and doesn't reset until the application restarts.
