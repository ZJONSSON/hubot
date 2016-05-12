#!/bin/bash

DATA_URL=$1
TEST_ROOT=$2
NODE_ENV=$3
TEMP_BUILD="/tmp/`echo $RANDOM$RANDOM`build.tar.gz"

echo "Testing $TEST_ROOT"
echo "DATA_URL=$DATA_URL"
echo "NODE_ENV=$NODE_ENV"
echo "TEMP_BUILD=$TEMP_BUILD"

wget -nv -c -t 10 --timeout=60 --waitretry=5 $DATA_URL -O $TEMP_BUILD

cd $TEMP_BUILD
npm run hubot-test

rm -rf $TEMP_BUILD

exit 0
'"
