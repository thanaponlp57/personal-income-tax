FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build shell

FROM nginx:alpine
EXPOSE 80
COPY --from=build /app/dist/shell/browser /usr/share/nginx/html
COPY docker/shell/nginx.conf /etc/nginx/conf.d/default.conf
