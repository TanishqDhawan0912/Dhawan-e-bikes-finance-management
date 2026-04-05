# Deploying this backend on Render

## What you need on Render

1. **Web Service** pointing at this repository.
2. **Root Directory** (if the repo is not only the API): set to `backend` so Render runs install/start from this folder.
3. **Build Command**: leave default empty, or use `npm install` (Render’s default for Node is fine).
4. **Start Command**: `npm start` (runs `node server.js` per `package.json`).

## Environment variables

Set these in the Render dashboard (**Environment** for the service):

| Variable       | Required | Notes |
|----------------|----------|--------|
| `MONGO_URI`    | Yes      | MongoDB connection string (e.g. Atlas). |
| `JWT_SECRET`   | Yes      | Secret for signing JWTs; use a long random string. |
| `PORT`         | No       | Render injects `PORT` automatically; you usually do not set it. |

Optional:

- `NODE_ENV` — Render typically sets this to `production` for web services.
- `HOST` — Defaults to `0.0.0.0` in code (correct for containers). Override only if you know you need to.

Behavior in production (`NODE_ENV=production`):

- **`JWT_SECRET` is required** — the process exits immediately if it is missing, so a bad deploy fails in logs instead of at first login.
- **`trust proxy`** is enabled so `req.ip` / logging behind Render’s reverse proxy stay correct.

Copy from `.env.example` locally; never commit real secrets.

## MongoDB (Atlas or other)

- Allow network access from Render: in Atlas, **Network Access** → allow **`0.0.0.0/0`** (or Render’s egress IPs if you lock it down later).
- Use the SRV connection string as `MONGO_URI`.

## Health check

Render can use **Health Check Path** `/` — the app responds with plain text `API Running`.

## Frontend / other clients

This repo’s API has no hardcoded public URL in the server code. Your **frontend** (or mobile app) must call your Render URL (e.g. `https://your-service.onrender.com`) via its own env (e.g. Vite `VITE_*` variables), not `http://localhost:5000`.

## If something fails

- **Build/install**: Ensure **Root Directory** is `backend` when the service lives in a subfolder. Run `npm install` locally inside `backend` to confirm `package.json` resolves.
- **Crash on boot**: Check logs for `MONGO_URI` / Mongo errors; verify Atlas IP allowlist and URI.
- **Start command**: Must be `npm start` or `node server.js` from the `backend` directory.

## Dependencies

Runtime dependencies are listed under `"dependencies"` in `package.json`. `devDependencies` (e.g. `nodemon`, `concurrently`) are only for local development; `npm start` does not need them.
