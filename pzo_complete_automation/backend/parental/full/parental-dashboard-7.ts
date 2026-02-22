import * as React from 'react';
import { useAuth } from './auth';
import firebase from 'firebase/app';
import 'firebase/auth';

const ParentalDashboard: React.FC = () => {
const auth = useAuth();

const handleSignOut = () => {
auth.signOut().then(() => {
// Sign-out successful.
});
};

React.useEffect(() => {
if (!auth.currentUser) return;

const age = new Date().getFullYear() - auth.currentUser.uid.slice(6, 8);

if (age < 18) {
handleSignOut();
}
}, [auth]);

if (!auth.currentUser) return <div>Please sign in to access the dashboard.</div>;

return (
<div>
<h1>Welcome, {auth.currentUser.displayName}!</h1>
<button onClick={handleSignOut}>Sign Out</button>
</div>
);
};

const config = {
apiKey: "API_KEY",
authDomain: "AUTH_DOMAIN",
projectId: "PROJECT_ID",
storageBucket: "STORAGE_BUCKET",
messagingSenderId: "MESSAGING_SENDER_ID",
appId: "APP_ID"
};
firebase.initializeApp(config);

export { ParentalDashboard, firebase };
