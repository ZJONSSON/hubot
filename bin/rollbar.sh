#!/bin/bash

ACCESS_TOKEN=$1
ENVIRONMENT=$2
REVISION=$3

curl https://api.rollbar.com/api/1/deploy/ \
  -F access_token=$ACCESS_TOKEN \
  -F environment=$ENVIRONMENT \
  -F revision=$REVISION
