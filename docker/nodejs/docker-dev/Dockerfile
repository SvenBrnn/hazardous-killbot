FROM node:20-alpine

# Create app directory
RUN mkdir -p /usr/src/app && yarn global add nodemon
WORKDIR /usr/src/app

# Exports
EXPOSE 3000
CMD [ "yarn", "start.dev" ]