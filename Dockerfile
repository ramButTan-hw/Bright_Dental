FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY clinic-medical/package*.json ./
RUN npm ci --no-audit --no-fund
COPY clinic-medical/ ./
RUN npm run build

FROM node:22-bookworm-slim AS production
ENV NODE_ENV=production PORT=3001
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --chown=node:node server.js queries.js ./
COPY --chown=node:node routes/ ./routes/
COPY --chown=node:node database/ ./database/
COPY --chown=node:node docker/ ./docker/
COPY --from=frontend --chown=node:node /build/dist/ ./clinic-medical/dist/
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 CMD ["node", "docker/healthcheck.js"]
ENTRYPOINT ["sh", "docker/entrypoint.sh"]
CMD ["node", "server.js"]
