#!/bin/bash

DATA_URL=$1
DATA_SHA=$1
TEST_ROOT=$2
NODE_ENV=$3
TEMP_BUILD="/tmp/`echo $RANDOM$RANDOM`build.tar.gz"

echo "Testing $TEST_ROOT"
echo "DATA_URL=$DATA_URL"
echo "DATA_SHA=$DATA_SHA"
echo "NODE_ENV=$NODE_ENV"
echo "TEMP_BUILD=$TEMP_BUILD"

REV=$(wget -nv -c -t 10 --timeout=60 --waitretry=5 $TEST_ROOT/auth/rev -O -)
if [ -z "${REV##*$DATA_SHA*}" ] ; then
  echo "Rev match"
else
  echo "Error: rev mismatch"
fi

wget -nv -c -t 10 --timeout=60 --waitretry=5 $DATA_URL -O $TEMP_BUILD

cd $TEMP_BUILD
npm run hubot-test

rm -rf $TEMP_BUILD

exit 0
'"
