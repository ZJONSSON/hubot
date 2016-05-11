#!/bin/bash

user=ubuntu
server=$1
host=$2
buildNumber=$3
appDataUrl=$4
sha=$5
NODE_ENV=$6
tag=$7
appFilename=$tag-$buildNumber

echo "Deploying build $buildNumber"
echo "user=$user"
echo "server=$server"
echo "host=$host"
echo "appDataUrl=$appDataUrl"
echo "sha=$sha"
echo "NODE_ENV=$NODE_ENV"
echo "tag=$tag"
echo "appFilename=$appFilename"

TEMP=$(mktemp /tmp/id_rsa.XXXXXXXX)
echo "$HUBOT_SSH_KEY" > $TEMP

ssh $user@$server -i $TEMP -o StrictHostKeyChecking=no bash -c "'
export UNPACKED=1

wget -nv -c -t 10 --timeout=60 --waitretry=5 $appDataUrl -O /tmp/app.tar.gz
mkdir -p /home/ubuntu/builds/$appFilename

echo Unpacking app
tar xzf /tmp/app.tar.gz -C /home/ubuntu/builds/$appFilename
rm -f /tmp/app.tar.gz

mkdir -p /home/ubuntu/logs
bash builds/$appFilename/deploy/remote-deploy.sh $appFilename $host $NODE_ENV $tag > /home/ubuntu/logs/app-deploy-$host.log 2>&1
exit 0
'"
