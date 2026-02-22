id = Column(Integer, primary_key=True)
user_id = Column(String)
consent_date = Column(String)
terms_accepted = Column(Boolean)

def __repr__(self):
return f'<Consent {self.user_id}>'

@app.route('/consent', methods=['POST'])
def add_consent():
data = request.get_json()

if not data or 'user_id' not in data or 'consent_date' not in data or 'terms_accepted' not in data:
return jsonify({"error": "Invalid request"}), 400

new_consent = Consent(user_id=data['user_id'], consent_date=data['consent_date'], terms_accepted=data['terms_accepted'])
db.session.add(new_consent)
db.session.commit()

return jsonify({"success": True}), 201

if __name__ == '__main__':
db.create_all()
app.run(debug=True)
```

This code sets up a Flask web application with an SQLite database to store user consents for an ML system. It creates a `Consent` model to represent the consent records, and provides an API endpoint (`/consent`) for adding new consent records. The endpoint expects JSON data containing the user's ID, consent date, and terms acceptance status.
