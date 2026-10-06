# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . ./
# Pass API base URL for production (relative /api/v1 so it routes through same origin Nginx reverse proxy)
ENV VITE_API_BASE_URL=/api/v1
RUN npm run build

# Production Nginx Stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
