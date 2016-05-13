FROM node:5.5.0
MAINTAINER Harrison Powers, harrisonpowers@gmail.com

RUN echo "deb http://packages.linuxmint.com debian import" | tee -a /etc/apt/sources.list
RUN apt-key adv --recv-keys --keyserver keyserver.ubuntu.com 3EE67F3D0FF405B2
RUN apt update && apt install vim xvfb openjdk-7-jre firefox -y

RUN npm i -g coffee-script

COPY . /usr/src/app
WORKDIR /usr/src/app

RUN npm i

ENV HUBOT_PORT 8080
ENV PORT ${HUBOT_PORT}
EXPOSE ${HUBOT_PORT}

CMD bin/hubot -a slack -n hubot
