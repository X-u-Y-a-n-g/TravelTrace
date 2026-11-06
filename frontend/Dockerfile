# syntax=docker/dockerfile:1
FROM node:22-alpine AS build

WORKDIR /app

# Map style is baked into the frontend build.
ARG VITE_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/positron
ENV VITE_MAP_STYLE_URL=$VITE_MAP_STYLE_URL

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
