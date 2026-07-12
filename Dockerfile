# syntax=docker/dockerfile:1
FROM dhi.io/node:26-alpine3.23-dev AS builder

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}
ENV CI=true

# Copy the entire git repo to the container to allow showLastUpdateTime on blog pages
COPY . /blog
WORKDIR /blog/blog
# hadolint ignore=DL3016 # pnpm version specified in package.json
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod && pnpm run build

FROM dhi.io/nginx:1.31.2-alpine3.23 AS runtime

COPY --from=builder /blog/blog/build /usr/share/nginx/html
COPY default.conf /etc/nginx/conf.d/default.conf
