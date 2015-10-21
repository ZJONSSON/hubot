#!/bin/bash

user=ubuntu
server=$1

echo "Taking down $server"

echo "$HUBOT_SSH_KEY" > /tmp/id_rsa

ssh $user@$server -i /tmp/id_rsa -o StrictHostKeyChecking=no bash -c "'
  docker stop \`docker ps -q --filter label=name=$server\` 2>/dev/null | docker rm 2>/dev/null
  docker rmi $server 2>/dev/null
'"
exit 0
