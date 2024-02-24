FROM node:20-alpine

ADD --chown=node:node . /workspace
RUN apk add --no-cache --update python3 python3-dev
USER node
WORKDIR /workspace
RUN yarn && yarn build

FROM node:20-alpine
COPY --from=0 --chown=node:node /workspace/dist/ /workspace/dist/
COPY --from=0 --chown=node:node /workspace/package.json /workspace/
RUN chown -R node:node /workspace && apk add --no-cache --update python3 python3-dev
USER node
WORKDIR /workspace
RUN yarn install --production=true

CMD ["yarn", "start"]