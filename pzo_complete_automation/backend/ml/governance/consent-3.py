id = db.Column(db.Integer, primary_key=True)
username = db.Column(db.String(64), unique=True, nullable=False)
password = db.Column(db.String(128), nullable=False)

class ConsentForm(db.Model):
id = db.Column(db.Integer, primary_key=True)
user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
consent_status = db.Column(db.Boolean, default=False)

@app.route('/consent', methods=['POST'])
def create_consent():
data = request.get_json()
user_id = data['user_id']
new_consent = ConsentForm(user_id=user_id, consent_status=True)
db.session.add(new_consent)
db.session.commit()
return jsonify({"message": "Consent granted"}), 201

if __name__ == '__main__':
app.run(debug=True)
```
