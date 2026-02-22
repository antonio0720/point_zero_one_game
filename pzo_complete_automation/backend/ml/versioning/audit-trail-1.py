id = db.Column(db.Integer, primary_key=True)
name = db.Column(db.String(100), nullable=False)
version = db.Column(db.Integer, nullable=False)
created_at = db.Column(db.DateTime, default=datetime.utcnow)
updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)

class AuditTrail(db.Model):
id = db.Column(db.Integer, primary_key=True)
dataset_id = db.Column(db.Integer, db.ForeignKey('dataset.id'), nullable=False)
action = db.Column(db.String(50), nullable=False)
user = db.Column(db.String(100), nullable=False)
created_at = db.Column(db.DateTime, default=datetime.utcnow)

@app.route('/datasets', methods=['POST'])
def create_dataset():
data = request.get_json()
dataset = Dataset(name=data['name'], version=data['version'])
db.session.add(dataset)
db.session.commit()
audit_trail = AuditTrail(dataset_id=dataset.id, action='create', user=os.getenv('USER'))
db.session.add(audit_trail)
db.session.commit()
return jsonify({'message': 'Dataset created successfully.'})

@app.route('/datasets/<int:dataset_id>/versions', methods=['PUT'])
def update_dataset_version(dataset_id):
data = request.get_json()
dataset = Dataset.query.get_or_404(dataset_id)
dataset.version = data['version']
db.session.commit()
audit_trail = AuditTrail(dataset_id=dataset_id, action='update', user=os.getenv('USER'))
db.session.add(audit_trail)
db.session.commit()
return jsonify({'message': 'Dataset version updated successfully.'})

if __name__ == '__main__':
app.run(debug=True)
```

This code includes:

- A `Dataset` model for storing ML datasets with their names, versions, and timestamps
- An `AuditTrail` model to record create and update actions on the dataset
- Endpoints to create a new dataset (`/datasets`) and update an existing dataset's version (`/datasets/{dataset_id}/versions`)
- The audit trail records the user who performed the action in each case.
