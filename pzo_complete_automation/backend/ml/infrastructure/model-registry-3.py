model_id = registry.register_model(request.json['name'], request.json['version'], request.json['path'])
return {'model_id': model_id}, 201

@app.route('/api/models', methods=['GET'])
def get_models():
models = registry.get_all()
return models

if __name__ == '__main__':
app.run(debug=True)
```
