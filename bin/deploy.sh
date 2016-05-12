#!/bin/bash

REMOTE_USER=ubuntu
SERVER=$1
VIRTUAL_HOST=$2
BUILD_NUM=$3
DATA_URL=$4
SHA=$5
NODE_ENV=$6
DOCKERTAG=$7
LOGTAG=$8

echo "Deploying build $BUILD_NUM"
echo "REMOTE_USER=$REMOTE_USER"
echo "SERVER=$SERVER"
echo "VIRTUAL_HOST=$VIRTUAL_HOST"
echo "DATA_URL=$DATA_URL"
echo "SHA=$SHA"
echo "NODE_ENV=$NODE_ENV"
echo "DOCKERTAG=$DOCKERTAG"
echo "LOGTAG=$LOGTAG"

TEMP_KEY=$(mktemp /tmp/XXXXXXXX.id_rsa)
echo "$HUBOT_SSH_KEY" > $TEMP_KEY

TEMP_BUILD="/tmp/`echo $RANDOM$RANDOM`build.tar.gz"

TEMP_REMOTE_DEPLOY="/tmp/`echo $RANDOM$RANDOM`remote-deploy.sh"
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $TEMP_KEY \
  $DIR/remote-deploy.sh $REMOTE_USER@$SERVER:$TEMP_REMOTE_DEPLOY

ssh $REMOTE_USER@$SERVER -i $TEMP_KEY -o StrictHostKeyChecking=no bash -c "'
export UNPACKED=1

chmod +x $TEMP_REMOTE_DEPLOY

wget -nv -c -t 10 --timeout=60 --waitretry=5 $DATA_URL -O $TEMP_BUILD

mkdir -p /home/ubuntu/logs

bash $TEMP_REMOTE_DEPLOY $TEMP_BUILD $VIRTUAL_HOST $NODE_ENV $DOCKERTAG $LOGTAG \
  > /home/ubuntu/logs/app-deploy-$VIRTUAL_HOST.log 2>&1

rm -f $TEMP_BUILD
rm -f $TEMP_REMOTE_DEPLOY

exit 0
'"
