import os
import json
from datetime import datetime, timedelta
from zope.interface import Interface, implementer
from pyramid.interfaces import IAuthenticationPolicy
from pyramid.authentication import AuthTktAuthenticationPolicy as BaseAuthTktPolicy
from pyramid.authorization import ACLAuthorizationPolicyFactory as DummyACLPolicy
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from pyramid_jinja2 import get_renderer
from pyramid.httpexceptions import HTTPFound, HTTPNotFound

Base = declarative_base()
DB_URL = os.environ['DATABASE_URL']
engine = create_engine(DB_URL)
Base.metadata.create_all(engine)

class User(Base):
__tablename__ = 'users'
id = Column(Integer, primary_key=True)
username = Column(String(128), unique=True)
password = Column(String(128))
email = Column(String(128), unique=True)
created_at = Column(DateTime, default=datetime.utcnow)

class Consent(Base):
__tablename__ = 'consents'
id = Column(Integer, primary_key=True)
user_id = Column(Integer, ForeignKey('users.id'))
data_set_id = Column(String(256))
agreed_at = Column(DateTime)
expires_at = Column(DateTime)

user = relationship("User")

class AuthPolicy(BaseAuthTktPolicy):
def unauthenticated_view(self, request):
return HTTPFound(location=self.authenticate(request))

class DBAuthPolicy(IAuthenticationPolicy):
__implements__ = IAuthenticationPolicy

def unauthenticated_userid(self, req):
userid = None
user = User.query.filter_by(email=req.params.get('email')).first()
if user:
userid = user.username
return userid

class ConsentPolicy(DummyACLPolicy):
def __init__(self, request):
self.request = request
self._authn_policy = DBAuthPolicy()

def __call__(self, resource):
def _check_consent(user, data_set_id):
consent = Consent.query.filter_by(user_id=user.id, data_set_id=data_set_id).first()
if consent:
return consent.agreed_at > datetime.utcnow() or consent.expires_at > datetime.utcnow() + timedelta(hours=24)
return False

def _get_user():
userid = self._authn_policy.unauthenticated_userid(self.request)
if userid:
return User.query.filter_by(username=userid).first()
return None

def _render_consent_form():
renderer = get_renderer()
return renderer.render('consent_form.jinja2', {'data_set': self.request.matchdict['dataset']})

resource.permit('GET', _check_consent(_get_user(), self.request.matchdict['dataset']))
resource.require('POST', _check_consent(_get_user(), self.request.matchdict['dataset']))

return resource
