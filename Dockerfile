# syntax=docker/dockerfile:1
FROM dhi.io/node:26-alpine3.23-dev AS builder

ENV NODE_ENV=production

COPY . /blog
WORKDIR /blog/zmuda-pro
RUN npm ci --omit=dev && npm run build

FROM dhi.io/nginx:1.31.2-alpine3.23 AS runtime

COPY --from=builder /blog/zmuda-pro/build /usr/share/nginx/html
COPY default.conf /etc/nginx/conf.d/default.conf
