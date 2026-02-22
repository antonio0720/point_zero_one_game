from flask import Flask, request, jsonify
from sqlalchemy import create_engine, MetaData, Table, select, insert, update
from sqlalchemy.orm import scoped_session, sessionmaker

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://username:password@localhost/db_name'
db = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=create_engine(app.config['SQLALCHEMY_DATABASE_URI'])))
metadata = MetaData()
models = {
'model': Table('models', metadata,
Column('id', Integer, primary_key=True),
Column('version', Integer),
Column('name', String)
)
}
metadata.create_all(db.bind)

def check_rollback():
query = select([models.c.id]).where(models.c.version > models.c.prev_version)
results = db.execute(query).fetchall()
return results

@app.route('/api/v1/rollback', methods=['POST'])
def rollback():
data = request.get_json()
model_id = data['model_id']
version = data['version']
prev_query = select([models.c.prev_version]).where(models.c.id == model_id)
prev_version = db.execute(prev_query).scalar()
if version < prev_version:
return jsonify({'error': 'Cannot rollback to a lower version.'}), 400
rollback_query = update(models).where(models.c.id == model_id, models.c.version >= version).values(prev_version=models.c.version)
db.execute(rollback_query)
db.commit()
return jsonify({'success': 'Model rolled back successfully.'})

@app.route('/api/v1/killswitch', methods=['POST'])
def kill_switch():
data = request.get_json()
model_id = data['model_id']
query = update(models).where(models.c.id == model_id).values(prev_version=models.c.version)
db.execute(query)
db.commit()
return jsonify({'success': 'Kill switch activated for model.'})

if __name__ == '__main__':
app.run(debug=True)
