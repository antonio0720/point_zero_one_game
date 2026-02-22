import React from 'react';
import { useLocation } from 'react-router-dom';

const AdminShell10 = () => {
const { pathname } = useLocation();

return (
<div className="admin-shell-10">
{pathname === '/admin' && <AdminDashboard />}
{pathname === '/admin/users' && <UserManagement />}
{/* Add more routes as needed */}
</div>
);
};

const AdminDashboard = () => (
// Dashboard component code here
);

const UserManagement = () => (
// User management component code here
);

export default AdminShell10;
