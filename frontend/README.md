# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Deploying on Vercel

1. Set the project **Root Directory** to `frontend` (this repo is a monorepo).
2. Under **Settings → Environment Variables**, add **`VITE_API_URL`** for **Production** (and Preview if needed) with your API origin only, e.g. `https://your-api.onrender.com` (no `/api` suffix).
3. **`vercel.json`** adds SPA rewrites so React Router routes work on refresh.
4. Vercel sets **`VERCEL=1`** during build; if **`VITE_API_URL`** is missing, the build fails with a clear error so you do not ship a bundle that still points at localhost.
