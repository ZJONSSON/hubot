## Hubot

`cp config.json ./`

`heroku create APPNAME`

`heroku git:remote -a APPNAME`

`heroku config:set HEROKU_URL=#### -a APPNAME`

`heroku config:set HUBOT_GITHUB_ORG=#### -a APPNAME`

`heroku config:set HUBOT_SLACK_TOKEN=#### -a APPNAME`

`heroku config:set HUBOT_SSH_KEY="$(cat id_rsa)" -a APPNAME`

`heroku addons:add redistogo:nano -a APPNAME`
