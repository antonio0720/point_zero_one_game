# Session 3: Persistence Layer Phase 2

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Commands](#commands)
3. [Done Criteria](#done-criteria)
4. [Smoke Tests](#smoke-tests)

## Prerequisites
- Ensure you have completed the previous session.
- Verify that all dependencies are up-to-date.

## Commands

### Step 1: Update Dependencies
```bash
npm install
```

### Step 2: Configure Database Connection
```bash
cp config.sample.js config.js
```
Edit `config.js` to include your database credentials.

### Step 3: Migrate Database Schema
```bash
npx sequelize db:migrate
```

### Step 4: Seed Initial Data
```bash
npx sequelize db:seed:all
```

## Done Criteria

- All dependencies are updated.
- The database connection is configured correctly.
- The database schema has been migrated successfully.
- Initial data has been seeded into the database.

## Smoke Tests

### Test 1: Database Connection
Run `node -e "require('./config.js').db.authenticate()"` to verify the database connection.

### Test 2: API Endpoints
Use a tool like Postman or cURL to test the API endpoints. Ensure they return expected responses.

### Test 3: Data Integrity
Verify that data is being persisted correctly by checking for inconsistencies in the database.
```bash
npx sequelize db:check
```
