#!/bin/bash

set -e

DATA_URL=$1
DATA_SHA=$2
TEST_ROOT=$3
NODE_ENV=$4
REPONAME=$5
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PARENT_DIR="$( dirname "$DIR" )"
TEMP_BUILD="/tmp/`echo $RANDOM$RANDOM`build"
CERT="$PARENT_DIR/certs/${REPONAME}-${NODE_ENV}-a.crt"
KEY="$PARENT_DIR/certs/${REPONAME}-${NODE_ENV}-a.key"

echo "Testing $TEST_ROOT"
echo "DATA_URL=$DATA_URL"
echo "DATA_SHA=$DATA_SHA"
echo "NODE_ENV=$NODE_ENV"
echo "TEMP_BUILD=$TEMP_BUILD"
echo "CERT=$CERT"
echo "KEY=$KEY"

REV=$(wget -nv -c -t 10 --timeout=60 --waitretry=5 \
  --certificate $CERT --private-key $KEY $TEST_ROOT/auth/rev -O -)
if [ -z "${REV##*$DATA_SHA*}" ] ; then
  echo "Rev match"
else
  echo "Error: rev mismatch"
fi

curl --silent --connect-timeout 60 --retry-delay 5 $DATA_URL -o $TEMP_BUILD.tar.gz
mkdir -p $TEMP_BUILD
tar xzf $TEMP_BUILD.tar.gz -C $TEMP_BUILD

mkdir -p $TEMP_BUILD/certs
cp -r $PARENT_DIR/certs/$REPONAME* $TEMP_BUILD/selenium/certs
cp $PARENT_DIR/firefox_profiles/${REPONAME}.js $TEMP_BUILD/selenium/certs/firefox-profile.js

cd $TEMP_BUILD
npm run hubot-test

rm -rf $TEMP_BUILD
rm -f $TEMP_BUILD.tar.gz

exit 0
'"
