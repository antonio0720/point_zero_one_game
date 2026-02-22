data = request.json
X = np.array([data['input']]).reshape(-1, 784)
X /= 255
prediction = model.predict(X)[0]
return jsonify({'output': str(np.argmax(prediction))})

if __name__ == '__main__':
app.run(debug=True)
```

Make sure to install the required libraries before running this script:

```bash
pip install flask tensorflow keras numpy
```
