#!/bin/bash

user=ubuntu
server=$1
host=$2
buildNumber=$3
appDataUrl=$4
sha=$5

BASEDIR=/var/ubuntu/apps

appFilename=app-$buildNumber

echo "$HUBOT_SSH_KEY" > /tmp/id_rsa

echo "Deploying build $buildNumber"

ssh $user@$server -i /tmp/id_rsa -o StrictHostKeyChecking=no bash -c "'
export UNPACKED=1

curl -s $appDataUrl -o /tmp/app.tar.gz
mkdir -p /home/ubuntu/builds/$appFilename

echo Unpacking app
tar xzf /tmp/app.tar.gz -C /home/ubuntu/builds/$appFilename
rm -f /tmp/app.tar.gz

bash builds/$appFilename/deploy/remote-deploy.sh $appFilename $host $host production >> /home/ubuntu/app-deploy.log
'"
