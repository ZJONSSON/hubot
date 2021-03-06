FROM ubuntu:14.04.4

MAINTAINER Harrison Powers, harrisonpowers@gmail.com

RUN sudo apt-get update && apt-get install -y curl && \
  curl -sL https://deb.nodesource.com/setup_5.x | sudo -E bash -

RUN sudo apt-get update && apt-get install -y --no-install-recommends \
  nodejs vim xvfb x11vnc openjdk-7-jre firefox build-essential wget openssh-client

RUN npm i -g coffee-script

COPY . /usr/src/app
WORKDIR /usr/src/app

RUN npm i

ENV HUBOT_PORT 8080
ENV PORT ${HUBOT_PORT}
EXPOSE ${HUBOT_PORT}

CMD bin/hubot -a slack -n hubot
