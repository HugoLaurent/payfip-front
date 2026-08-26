# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .

# Les variables VITE_* sont figées au build (Vite les inline dans le
# bundle) — pas une variable d'environnement runtime comme côté backend.
ARG VITE_GATEWAY_URL
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL
ARG VITE_GLITCHTIP_DSN
ENV VITE_GLITCHTIP_DSN=$VITE_GLITCHTIP_DSN
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
