# Stage 1: build
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build personal-income-tax && npx ng build shell --configuration production-ssl

# Stage 2: serve
FROM nginx:alpine
COPY --from=builder /app/dist/personal-income-tax/browser /usr/share/nginx/remote
COPY --from=builder /app/dist/shell/browser              /usr/share/nginx/shell
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 4200 4201
