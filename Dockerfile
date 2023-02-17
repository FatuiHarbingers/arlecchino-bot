# Base Stage
FROM node:18-alpine3.15 AS base

WORKDIR /home/node/app

ENV NODE_ENV="development"
ENV CI=true

RUN wget -q -t3 'https://packages.doppler.com/public/cli/rsa.8004D9FF50437357.key' -O /etc/apk/keys/cli@doppler-8004D9FF50437357.rsa.pub && \
    echo 'https://packages.doppler.com/public/cli/alpine/any-version/main' | tee -a /etc/apk/repositories

RUN apk add -u --no-cache \
	dumb-init \
	fontconfig \
	jq \
	nodejs \
    doppler \
	build-base \
	g++ \
	cairo-dev \
	jpeg-dev \
	pango-dev \
	giflib-dev \
	git \
	openssh

COPY --chown=node:node yarn.lock .
COPY --chown=node:node package.json .
COPY --chown=node:node .yarn/ .yarn/
COPY --chown=node:node doppler.yaml .
RUN sed -i 's/dev/prd/g' doppler.yaml
COPY --chown=node:node prisma/ .
COPY --chown=node:node .yarnrc.yml .
# Remove global cache config line
RUN echo "$(tail -n +2 .yarnrc.yml)" > .yarnrc.yml

ENTRYPOINT [ "dumb-init", "--" ]

# Build Stage
FROM base AS builder

WORKDIR /home/node/app

ENV NODE_ENV="development"

COPY --chown=node:node tsconfig.json tsconfig.json
COPY --chown=node:node prisma/ .

ARG GH_TOKEN
RUN git config --global url."https://$GH_TOKEN@github.com/".insteadOf ssh://git@github.com/
RUN yarn install --immutable

COPY --chown=node:node src/ src/
RUN yarn run build

# Runner Stage
FROM base AS runner

WORKDIR /home/node/app

ENV NODE_ENV="production"

COPY --chown=node:node --from=builder /home/node/app/dist dist
COPY --chown=node:node --from=builder /home/node/app/prisma prisma

ARG GH_TOKEN
RUN git config --global url."https://$GH_TOKEN@github.com/".insteadOf ssh://git@github.com/
RUN yarn workspaces focus --all --production
RUN chown node:node /home/node/app

USER node

CMD [ "doppler", "run", "--", "yarn", "start" ]