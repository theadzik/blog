FROM dhi.io/nginx:1.31.1-alpine3.23

COPY zmuda-pro/build /usr/share/nginx/html
COPY default.conf /etc/nginx/conf.d/default.conf
