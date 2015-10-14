#!/bin/bash

user=ubuntu
server=$1
host=$2
buildNumber=$3
appDataUrl=$4
sha=$5
NODE_ENV=$6

appFilename=app-$buildNumber
BASEDIR=/var/ubuntu/apps

echo "$HUBOT_SSH_KEY" > /tmp/id_rsa

echo "Deploying build $buildNumber"
echo "user=$user"
echo "server=$server"
echo "host=$host"
echo "appDataUrl=$appDataUrl"
echo "sha=$sha"
echo "appFilename=$appFilename"


ssh $user@$server -i /tmp/id_rsa -o StrictHostKeyChecking=no bash -c "'
export UNPACKED=1

wget -nv -c -t 10 --timeout=60 --waitretry=5 $appDataUrl -O /tmp/app.tar.gz
mkdir -p /home/ubuntu/builds/$appFilename

echo Unpacking app
tar xzf /tmp/app.tar.gz -C /home/ubuntu/builds/$appFilename
rm -f /tmp/app.tar.gz

mkdir -p /home/ubuntu/logs
bash builds/$appFilename/deploy/remote-deploy.sh $appFilename $host $host $NODE_ENV >> /home/ubuntu/logs/app-deploy-$host.log
'"
