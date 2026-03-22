# Medical Clinic Project
Team 1 COSC 3380

## Prerequisites
- Node.js (v14+)
- MySQL (local or remote)
- npm or yarn

## Setup Instructions

### 1. Database Configuration
Create a `.env` file in the project root:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=medical-clinic
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd clinic-medical
npm install
cd ..
```

### 3. Initialize Database
```bash
# Run schema migrations
node database/init-db.js
```

## Running the Application

### Development Mode
You need to run **two separate processes**:

#### Terminal 1: Backend API Server
```bash
node server.js
# Server will run on http://localhost:3001
```

#### Terminal 2: Frontend Development Server
```bash
cd clinic-medical
npm run dev
# Frontend will run on http://localhost:5173 (or similar)
```

### Production Mode
```bash
# Build frontend
cd clinic-medical
npm run build

# Serve backend (frontend static files must be served separately or integrated)
node server.js
```


