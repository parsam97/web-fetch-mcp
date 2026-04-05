# ---- Build stage ----
FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

RUN npm prune --omit=dev


# ---- Production stage ----
FROM node:22-slim

# System libraries required by Chromium (Puppeteer stealth mode)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxshmfence1 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Production node_modules (includes Puppeteer JS, excludes devDependencies)
COPY --from=build /app/node_modules ./node_modules

# Puppeteer's Chromium binary (downloaded during npm ci)
COPY --from=build /root/.cache/puppeteer /root/.cache/puppeteer

# Compiled output + package.json (needed for ESM resolution)
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

# Run as non-root user — symlink Chromium cache instead of copying (saves ~650MB)
RUN groupadd -r mcpuser && useradd -r -g mcpuser -d /home/mcpuser -m mcpuser \
    && chown -R mcpuser:mcpuser /app \
    && mkdir -p /home/mcpuser/.cache \
    && ln -s /root/.cache/puppeteer /home/mcpuser/.cache/puppeteer

USER mcpuser

ENV NODE_ENV=production

LABEL org.opencontainers.image.title="web-fetch-mcp"
LABEL org.opencontainers.image.description="MCP server that fetches web pages as clean, LLM-ready markdown"
LABEL org.opencontainers.image.source="https://github.com/parsam97/web-fetch-mcp"

ENTRYPOINT ["node", "dist/index.js"]
