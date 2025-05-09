FROM node:23-alpine3.21 AS builder

WORKDIR /docusaurus
COPY zmuda-pro/ /docusaurus
RUN npm ci && npm run build

FROM nginxinc/nginx-unprivileged:1.27.4-alpine3.21-slim

COPY --from=builder "/docusaurus/build" /usr/share/nginx/html
COPY default.conf /etc/nginx/conf.d/default.conf
