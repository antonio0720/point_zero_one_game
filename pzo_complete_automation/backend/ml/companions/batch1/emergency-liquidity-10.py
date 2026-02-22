data = request.get_json()
if not data:
return jsonify({"error": "Empty data provided."}), 400

X = [data[key] for key in model.feature_names_in_]
prediction = model.predict([X])

result = session.query(emergency_liquidity).filter_by(id=prediction[0]).first()
if not result:
return jsonify({"error": "Invalid prediction."}), 400

return jsonify({'amount': result.amount})

if __name__ == '__main__':
app.run(debug=True)
```
