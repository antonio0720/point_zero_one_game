# Assuming a simple round robin strategy for now, adjust this based on your requirements
return request.args.get('treatment', 0) == '1'

@app.route('/predict', methods=['POST'])
def predict():
treatment = split_traffic(request)

if treatment:
# Send requests to the new model for treatment group
data = request.get_json()
prediction = model_new.predict([data])
else:
# Send requests to the old model for control group
data = request.get_json()
prediction = model.predict([data])

response = {
'prediction': prediction[0],
'treatment': treatment,
}

return jsonify(response)

if __name__ == "__main__":
app.run(host='0.0.0.0', port=8080)
```

In this example, we assume that you already have two pre-trained models: `model` (the old model) and `model_new` (the new model). The A/B testing is done based on the treatment parameter sent in the request. If `treatment=1`, then the new model is used to make predictions, otherwise, the old model is used.
