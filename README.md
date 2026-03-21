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

## API Endpoints

- **POST** `/api/patients/check-email` - Verify if email exists
- **POST** `/api/patients/register` - Register new patient
- **GET** `/api/intake/pain-symptoms` - Fetch pain assessment symptoms

## Configuring Frontend API URL

The frontend by default connects to `http://localhost:3001`. To change this:

1. Create/edit `.env` file in `clinic-medical/`:
```
VITE_API_URL=http://your-api-url:port
```

2. Rebuild the frontend:
```bash
cd clinic-medical
npm run build
```

## Troubleshooting

### "We could not verify your email right now" Error
1. **Check backend is running**: Ensure `node server.js` is running on port 3001
2. **Check frontend can reach backend**: Verify `http://localhost:3001/api/patients/check-email` is accessible
3. **Check browser console**: Open DevTools and look for network/error messages
4. **Check server logs**: Look for error messages in the terminal running `node server.js`
5. **Verify VITE_API_URL**: If using custom URL, make sure it's correctly set in `.env`

### Database Connection Issues
- Verify MySQL service is running
- Check `.env` database credentials
- Ensure `DB_NAME=medical-clinic` database exists
- Check firewall/network connectivity to database host

## Development Notes
- Backend uses plain Node.js HTTP server (no Express.js)
- Frontend uses React with Vite build tool
- Database: MySQL with normalized intake schemas
- CORS is enabled for all origins during development

## Git Workflow
- Create a feature branch before making changes
- Push changes to branch before merging to main branch
