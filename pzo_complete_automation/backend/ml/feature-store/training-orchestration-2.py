id = db.Column(db.Integer, primary_key=True)
name = db.Column(db.String(100), nullable=False)
status = db.Column(db.String(20), default='pending')
command = db.Column(db.Text, nullable=False)

def train(job_id):
job = Job.query.get(job_id)
if not job:
return {'error': 'Job not found'}
try:
subprocess.check_call(job.command, shell=True)
job.status = 'completed'
except Exception as e:
job.status = 'failed'
print(f'Training failed for job {job_id}: {e}')
db.session.commit()
return {'message': 'Training started'}

@app.route('/jobs', methods=['POST'])
def create_job():
data = request.get_json()
if not data or 'name' not in data or 'command' not in data:
return jsonify({'error': 'Invalid request'}), 400
job = Job(name=data['name'], command=data['command'])
db.session.add(job)
db.session.commit()
redis.rpush('jobs', str(job.id))
return jsonify({'message': 'Job created'}), 201

@app.route('/jobs/<int:job_id>', methods=['GET'])
def get_job_status(job_id):
job = Job.query.get(job_id)
if not job:
return jsonify({'error': 'Job not found'}), 404
return jsonify({'name': job.name, 'status': job.status})

@app.route('/jobs/<int:job_id>/train', methods=['POST'])
def train_job(job_id):
job = Job.query.get(job_id)
if not job:
return jsonify({'error': 'Job not found'}), 404
if job.status != 'pending':
return jsonify({'error': 'Job already in progress or completed'}), 409
train(job_id)
return get_job_status(job_id)

@app.route('/jobs/next', methods=['GET'])
def get_next_pending_job():
job_id = redis.lpop('jobs')
if not job_id:
return jsonify({'message': 'No pending jobs'}), 204
job = Job.query.get(int(job_id))
if not job or job.status != 'pending':
redis.rpush('jobs', job_id)
return jsonify({'error': 'Job not found or already in progress/completed'}), 404
train(int(job_id))
return get_job_status(int(job_id))

if __name__ == '__main__':
app.run(debug=True)
```
