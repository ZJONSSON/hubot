#!/bin/bash

user=ubuntu
server=$1

echo "Taking down $server"

echo "$HUBOT_SSH_KEY" > /tmp/id_rsa

ssh $user@$server -i /tmp/id_rsa -o StrictHostKeyChecking=no bash -c "'
  docker ps -q --filter label=name=$server | xargs docker stop | xargs docker rm &> /dev/null
'"
