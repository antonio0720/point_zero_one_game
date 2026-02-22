id = db.Column(db.Integer, primary_key=True)
team1 = db.Column(db.String(80), nullable=False)
team2 = db.Column(db.String(80), nullable=False)
score1 = db.Column(db.Integer, nullable=False)
score2 = db.Column(db.Integer, nullable=False)

@app.route('/match', methods=['POST'])
def create_match():
data = request.get_json()

if not data or 'team1' not in data or 'team2' not in data or 'score1' not in data or 'score2' not in data:
return jsonify({"error": "Invalid request"}), 400

new_match = Match(team1=data['team1'], team2=data['team2'], score1=data['score1'], score2=data['score2'])
db.session.add(new_match)
db.session.commit()

return jsonify({"message": "Match created successfully"}), 201

@app.route('/matches', methods=['GET'])
def get_matches():
matches = Match.query.all()
result = []

for match in matches:
match_data = {'id': match.id, 'team1': match.team1, 'team2': match.team2, 'score1': match.score1, 'score2': match.score2}
result.append(match_data)

return jsonify(result)

if __name__ == '__main__':
db.create_all()
app.run(debug=True)
```

This script creates a Flask application with an SQLite database for storing matches. The `/match` endpoint accepts POST requests to create new matches, and the `/matches` endpoint retrieves all stored matches as JSON.
