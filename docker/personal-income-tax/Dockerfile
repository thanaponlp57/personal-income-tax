FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build personal-income-tax

FROM nginx:alpine
EXPOSE 80
COPY --from=build /app/dist/personal-income-tax/browser /usr/share/nginx/html
COPY docker/personal-income-tax/nginx.conf /etc/nginx/conf.d/default.conf
