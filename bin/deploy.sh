#!/bin/bash

user=ubuntu
server=$1
buildNumber=$2
appDataUrl=$3
sha=$4
appUrl=$5

BASEDIR=/var/ubuntu/apps

appFilename=app-$buildNumber

echo "$HUBOT_SSH_KEY" > /tmp/id_rsa

echo "Deploying build $buildNumber"

ssh $user@$server -i /tmp/id_rsa -o StrictHostKeyChecking=no bash -c "'
export UNPACKED=1

cd /tmp
curl -s $appDataUrl -o app.tar.gz

mkdir -p builds/$appFilename
echo Unpacking app
tar xzf /tmp/app.tar.gz -C builds/$appFilename > /dev/null
rm -f /tmp/app.tar.gz

bash builds/$appFilename/deploy/remote-deploy.sh $appFilename $appUrl >> /tmp/app-deploy.log

grep $sha $BASEDIR/.rev && echo SHA OK
'"
