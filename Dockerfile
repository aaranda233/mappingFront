# =========================
# Etapa base (instala dependencias)
# =========================
FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# =========================
# Etapa de desarrollo (hot reload)
# =========================
FROM base AS dev

RUN apk add --no-cache bash

EXPOSE 3000 5173 8080

CMD ["npx", "webpack", "serve", "--open", "--config", "webpack.config.js"]

# =========================
# Etapa de build (compila el frontend)
# =========================
FROM base AS build

RUN npm run build

# =========================
# Etapa de producción (con NGINX)
# =========================
FROM nginx:alpine AS production

COPY --from=build /app/build /usr/share/nginx/html

# Copia la configuración NGINX personalizada
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

