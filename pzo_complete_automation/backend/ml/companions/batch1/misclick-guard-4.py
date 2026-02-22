import os
from flask import Flask, request, jsonify, session
from redis import Redis

app = Flask(__name__)
redis_client = Redis(host='localhost', port=6379)

SECRET_KEY = os.urandom(24)
APP_URL = 'http://localhost:5000'

def init_session(user_id):
session.permanent = True
session['user_id'] = user_id
session.modified = True

@app.before_request
def before_request():
if redis_client.exists(f'session:{session["user_id"]}'):
session.pop('user_id', None)
init_session(redis_get_user_id())

def redis_get_user_id():
return redis_client.get('user_id') if redis_client.exists('user_id') else None

@app.route('/login', methods=['POST'])
def login():
user_id = request.json.get('user_id')
init_session(user_id)
redis_client.set('user_id', user_id, ex=3600)
return jsonify({'success': True})

@app.route('/click', methods=['POST'])
def click():
if request.json.get('is_click') and session['user_id']:
redis_client.incr(f'clicks:{session["user_id"]}')
return jsonify({'success': True})
else:
redis_client.set(f'misclicks:{session["user_id"]}', 1, ex=3600)
return jsonify({'success': False})

@app.route('/stats', methods=['GET'])
def stats():
clicks = redis_client.scard(f'clicks:{session["user_id"]}')
misclicks = redis_client.get(f'misclicks:{session["user_id"]}').decode('utf-8')
return jsonify({'clicks': clicks, 'misclicks': int(misclicks)})

if __name__ == '__main__':
app.config['SECRET_KEY'] = SECRET_KEY
app.run(debug=True)
