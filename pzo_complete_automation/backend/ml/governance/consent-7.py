id = db.Column(db.Integer, primary_key=True)
user_id = db.Column(db.Integer, nullable=False)
consent_date = db.Column(db.DateTime, default=datetime.utcnow)
data_type = db.Column(db.String(100), nullable=False)
status = db.Column(db.Boolean, default=True)

def __repr__(self):
return f'<Consent {self.id} {self.user_id} {self.data_type}>'

@app.route('/consent', methods=['POST'])
def create_consent():
data = request.get_json()
if not data or 'user_id' not in data or 'data_type' not in data:
return jsonify({"error": "Invalid input"}), 400

consent = Consent(user_id=data['user_id'], data_type=data['data_type'])
db.session.add(consent)
db.session.commit()

return jsonify({"success": True, "id": consent.id}), 201

@app.route('/consent/<int:id>', methods=['PUT'])
def update_consent(id):
data = request.get_json()
consent = Consent.query.get_or_404(id)

if 'status' in data and data['status'] is not None:
consent.status = data['status']

db.session.commit()
return jsonify({"success": True}), 200

if __name__ == "__main__":
db.create_all()
app.run(debug=True)
```
