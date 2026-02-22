id = Column(Integer, primary_key=True)
name = Column(String(100))
description = Column(String(255))
created_at = Column(String(30))
updated_at = Column(String(30))
model_artifact_id = Column(Integer, ForeignKey('modelartifact.id'))

model_artifact = relationship("ModelArtifact", backref="model")

class ModelArtifact(db.Model):
id = Column(Integer, primary_key=True)
path = Column(String(255))

models = relationship("Model", backref="model_artifact")

@app.route('/models', methods=['POST'])
def add_model():
data = request.get_json()
model = Model(name=data['name'], description=data['description'], created_at=data['created_at'], updated_at=data['updated_at'])
db.session.add(model)
db.session.commit()
return jsonify({'id': model.id})

@app.route('/models/<int:id>/artifact', methods=['POST'])
def add_model_artifact(id):
data = request.get_json()
model = Model.query.get(id)
artifact = ModelArtifact(path=data['path'])
db.session.add(artifact)
model.model_artifact = artifact
db.session.commit()
return jsonify({'id': artifact.id})

if __name__ == '__main__':
app.app_context().push()
db.create_all()
app.run(debug=True)
```

This script creates a simple API for adding models and their associated artifacts to the registry. The `Model` class represents a model with name, description, creation, and update timestamps, as well as a foreign key referencing the related `ModelArtifact`. The `ModelArtifact` class represents the model artifact file, and it has a one-to-many relationship with the `Model` class. There are also routes for adding new models (`/models`) and their associated artifacts (`/models/{model_id}/artifact`).
