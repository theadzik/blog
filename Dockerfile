# syntax=docker/dockerfile:1
FROM dhi.io/node:26-alpine3.23-dev AS builder

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV CI=true

# Copy the entire git repo to the container to allow showLastUpdateTime on blog pages
COPY . /blog
WORKDIR /blog/zmuda-pro
# corepack activates the exact pnpm from package.json "packageManager", so the
# build tool is pinned with the lockfile instead of resolving to whatever the
# registry serves as latest at build time.
RUN corepack enable && pnpm install --frozen-lockfile --prod && pnpm run build

FROM dhi.io/nginx:1.31.3-alpine3.23 AS runtime

COPY --from=builder /blog/zmuda-pro/build /usr/share/nginx/html
COPY default.conf /etc/nginx/conf.d/default.conf
