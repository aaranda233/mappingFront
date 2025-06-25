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

EXPOSE 5173 3000 8080

CMD ["npx", "webpack", "serve", "--open", "--config", "webpack.config.js"]

# =========================
# Etapa de producción (con NGINX)
# =========================
FROM nginx:alpine AS production

COPY --from=base /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
