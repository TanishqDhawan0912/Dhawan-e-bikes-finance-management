# Finance Management System

## Quick Start

### Start Both Frontend and Backend Together

```bash
# For development (with nodemon auto-restart)
npm run dev:all

# For production
npm run start:all
```

### Individual Commands

```bash
# Backend only
npm start
npm run dev

# Frontend only
cd ../frontend && npm run dev

# Install all dependencies
npm run install:all
```

## Project Structure

- `backend/` - Node.js/Express API server
- `frontend/` - React/Vite frontend application

## Available Scripts

- `npm run dev:all` - Start backend with nodemon AND frontend dev server
- `npm run start:all` - Start production backend AND frontend dev server
- `npm run dev` - Start backend only with nodemon
- `npm run start` - Start backend only in production mode
- `npm run install:all` - Install dependencies for both backend and frontend
- `npm run install:frontend` - Install frontend dependencies only

## Environment (backend)

- **`MONGO_URI`** — Required. Single MongoDB connection string (e.g. MongoDB Atlas). The app uses one `mongoose.connect(MONGO_URI)`; there is no secondary or local database connection.
- **`PORT`** — Optional; defaults handled in code (typically `5000`).

## Port Configuration

- Backend: listens on `PORT` (e.g. 5000)
- Frontend: Vite dev server (usually port 5173)

## Deployment

For Vercel deployment:

1. Deploy frontend to Vercel
2. Deploy backend separately (Vercel Functions, Render, or similar)
3. Update frontend API URLs to point to deployed backend
