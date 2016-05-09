FROM node:5.5.0
MAINTAINER Harrison Powers, harrisonpowers@gmail.com

RUN npm i -g coffee-script

COPY . /usr/src/app
WORKDIR /usr/src/app

RUN npm i

ENV HUBOT_PORT 8080
ENV PORT ${HUBOT_PORT}
EXPOSE ${HUBOT_PORT}

CMD bin/hubot -a slack -n hubot
