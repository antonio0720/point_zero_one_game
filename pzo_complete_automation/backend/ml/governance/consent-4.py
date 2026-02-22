from flask import Flask, request, jsonify
from sqlalchemy import create_engine, Column, Integer, String, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

app = Flask(__name__)
DB_URL = "sqlite:///consent.db"
Base = declarative_base()

class User(Base):
__tablename__ = 'users'
id = Column(Integer, primary_key=True)
name = Column(String)
email = Column(String)
consent = Column(Boolean, default=False)

engine = create_engine(DB_URL)
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)

def get_user(user_id):
session = Session()
return session.query(User).filter_by(id=user_id).first()

@app.route('/consent', methods=['POST'])
def handle_consent():
data = request.get_json()

user_email = data.get('email')
user_name = data.get('name')
consent_value = data.get('consent', False)

existing_user = get_user(user_id=None)

if not existing_user:
new_user = User(name=user_name, email=user_email, consent=consent_value)
Session().add(new_user)
Session().commit()

elif user_email == existing_user.email:
existing_user.consent = consent_value
Session().commit()

return jsonify({'message': 'Consent updated successfully'})

if __name__ == '__main__':
app.run(debug=True)
