from flask import Flask, request, jsonify
import json
import re

app = Flask(__name__)

misclick_urls = []

@app.route('/add_url', methods=['POST'])
def add_url():
data = request.get_json()
url = data.get('url')
if not url:
return jsonify({'error': 'No URL provided.'}), 400
misclick_urls.append(url)
return jsonify({'success': True}), 200

@app.route('/check_click', methods=['POST'])
def check_click():
data = request.get_json()
click_url = data.get('clicked_url')
if not click_url:
return jsonify({'error': 'No clicked URL provided.'}), 400

for misclick in misclick_urls:
if re.match(r'.*' + misclick + r'.*/?', click_url):
return jsonify({'misclick': True}), 200

return jsonify({'misclick': False}), 200

if __name__ == '__main__':
app.run(debug=True)
