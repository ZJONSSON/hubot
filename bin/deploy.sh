#!/bin/bash

REMOTEUSER=ubuntu
SERVER=$1
VIRTUAL_HOST=$2
BUILD_NUM=$3
DATA_URL=$4
SHA=$5
NODE_ENV=$6
DOCKERTAG=$7
LOGTAG=$8

FILENAME=$DOCKERTAG-$BUILD_NUM

echo "Deploying build $BUILD_NUM"
echo "REMOTEUSER=$REMOTEUSER"
echo "SERVER=$SERVER"
echo "VIRTUAL_HOST=$VIRTUAL_HOST"
echo "DATA_URL=$DATA_URL"
echo "SHA=$SHA"
echo "NODE_ENV=$NODE_ENV"
echo "DOCKERTAG=$DOCKERTAG"
echo "LOGTAG=$LOGTAG"
echo "FILENAME=$FILENAME"

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REMOTEDEPLOY=$(<$DIR/remote-deploy.sh)

TEMP_KEY=$(mktemp /tmp/XXXXXXXX.id_rsa)
echo "$HUBOT_SSH_KEY" > $TEMP_KEY

ssh $REMOTEUSER@$SERVER -i $TEMP_KEY -o StrictHostKeyChecking=no bash -c "'
export UNPACKED=1

TEMP_REMOTEDEPLOY=$(mktemp /tmp/remote-deployXXXXXXXX.sh)
echo \"$REMOTEDEPLOY\" > $TEMP_REMOTEDEPLOY
chmod +x $TEMP_REMOTEDEPLOY

TEMP_BUILD=$(mktemp /tmp/buildXXXXXXXX.tar.gz)
wget -nv -c -t 10 --timeout=60 --waitretry=5 $DATA_URL -O $TEMP_BUILD

mkdir -p /home/ubuntu/logs

bash $TEMP_REMOTEDEPLOY $TEMP_BUILD $VIRTUAL_HOST $NODE_ENV $DOCKERTAG $LOGTAG \
  > /home/ubuntu/logs/app-deploy-$host.log 2>&1

rm -f $TEMP_BUILD

exit 0
'"
