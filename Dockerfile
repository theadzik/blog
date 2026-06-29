# syntax=docker/dockerfile:1
FROM dhi.io/node:26-alpine3.23-dev AS builder

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

# Copy the entire git repo to the container to allow showLastUpdateTime on blog pages
COPY . /blog
WORKDIR /blog/zmuda-pro
RUN npm ci --omit=dev && npm run build

FROM dhi.io/nginx:1.31.2-alpine3.23 AS runtime

COPY --from=builder /blog/zmuda-pro/build /usr/share/nginx/html
COPY default.conf /etc/nginx/conf.d/default.conf
