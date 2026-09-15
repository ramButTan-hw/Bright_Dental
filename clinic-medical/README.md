# Bright Dental frontend

React/Vite frontend for Bright Dental. See the [project README](../README.md) for Docker and development setup and the [Azure guide](../docs/azure-deployment.md) for deployment.

```bash
npm ci
npm run dev
npm run build
```

Vite proxies `/api` to `http://127.0.0.1:3001`. Production assets are built into the project Docker image and served by the Node API server on the same origin. Standalone frontend builds can set `VITE_API_URL` at build time.
