FROM nginxinc/nginx-unprivileged:1.29.3-alpine3.22-slim

COPY zmuda-pro/build /usr/share/nginx/html
COPY default.conf /etc/nginx/conf.d/default.conf
