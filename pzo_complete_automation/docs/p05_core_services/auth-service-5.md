# Auth Service 5

## Overview

The `Auth Service 5` is a core service responsible for user authentication and authorization within the system. It handles creating, updating, deleting, and retrieving user accounts, as well as managing their access to various resources.

## Functionalities

- **User Authentication**: The service verifies the credentials of users attempting to log in.
- **User Registration**: New users can register for an account, providing necessary personal information and a password.
- **Password Management**: Users can reset their passwords if they forget them.
- **Access Control**: The service enforces access control policies based on user roles and permissions.
- **Session Management**: It maintains the state of active sessions to manage authenticated users and log them out when necessary.

## API Endpoints

### User Authentication

- `POST /auth/login`: Logs in a user, returning a JWT upon successful authentication.
- `GET /auth/logout`: Terminates the current session for a logged-in user.

### User Registration & Management

- `POST /users`: Registers a new user account.
- `PUT /users/:id`: Updates an existing user's information.
- `DELETE /users/:id`: Deletes a user account.

### Password Management

- `POST /auth/resetPassword`: Allows users to reset their password, sending a reset link to the registered email address.
- `PUT /auth/confirmPasswordReset/:token`: Confirms and sets a new password during the password reset process.

## Dependencies

- **Database**: The service depends on a relational database (e.g., PostgreSQL, MySQL) for storing user data and managing sessions.
- **Authentication Library**: A secure authentication library is used to handle encryption, hashing, and JWT generation.
- **Email Service**: For sending password reset emails.
