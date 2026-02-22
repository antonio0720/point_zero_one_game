__tablename__ = 'datasets'
id = Column(Integer, primary_key=True)
name = Column(String)
created_at = Column(DateTime)
version = Column(Integer)

def save(self):
db_session.add(self)
db_session.flush()

class DatasetVersion(Base):
__tablename__ = 'dataset_versions'
id = Column(Integer, primary_key=True)
dataset_id = Column(Integer, ForeignKey('datasets.id'))
version = Column(Integer, primary_key=True)
created_at = Column(DateTime)
description = Column(String)

class Lineage(Base):
__tablename__ = 'lineages'
id = Column(Integer, primary_key=True)
dataset_version_id = Column(Integer, ForeignKey('dataset_versions.id'))
child_dataset_version_id = Column(Integer, ForeignKey('dataset_versions.id'))
created_at = Column(DateTime)

@app.route('/datasets', methods=['POST'])
def create_dataset():
data = request.get_json()
dataset = Dataset(name=data['name'], version=data['version'], created_at=datetime.utcnow())
dataset.save()
return jsonify({'id': dataset.id})

@app.route('/datasets/<int:dataset_id>/versions', methods=['POST'])
def create_dataset_version(dataset_id):
data = request.get_json()
version = DatasetVersion(dataset_id=dataset_id, version=data['version'], created_at=datetime.utcnow(), description=data['description'])
version.save()
return jsonify({'id': version.id})

@app.route('/datasets/<int:dataset_id>/versions/<int:version_id>/lineage', methods=['POST'])
def create_lineage(dataset_id, version_id):
data = request.get_json()
child_version_id = int(data['child_version_id'])
lineage = Lineage(dataset_version_id=version_id, child_dataset_version_id=child_version_id, created_at=datetime.utcnow())
lineage.save()
return jsonify({'id': lineage.id})

if __name__ == '__main__':
db_session.create_all()
app.run(debug=True)
```
