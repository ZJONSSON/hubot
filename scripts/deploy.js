/*
  Description:
    Hubot deploy script

  Configuration:
    HUBOT_SSH_KEY - `heroku config:set HUBOT_SSH_KEY="$(echo id_rsa)"`
    config.json - {
      "username/reponame": {
        "servers": { "dev": '', "prod(optional)": '' , "server(optional)": ''}
      },
      etc..
    }

  Commands:
    hubot deploy user/repo#branch
    post(/hubot/deploy, { payload: { username: '', reponame: '', branch: '' }, prod: boolean })
*/

var CircleCI = require('circleci');
var Promise = require('bluebird');
var execAsync = Promise.promisify(require('child_process').exec);
var env = require('nconf').argv().env().file('default', 'config.json');
var deploySync = {};
var room = 'engineering-git';

module.exports = function(hubot) {
  hubot.router.post('/hubot/deploy', function(req, res) {
    var user = req.body.payload.username;
    var repo = req.body.payload.reponame;
    var branch = req.body.payload.branch;
    var prod = req.body.prod;
    var server = req.body.server;
    res.send('OK');
    deploy({ user:user, repo:repo, branch:branch, prod:prod, server:server, res:{ send:function(msg) {
      console.log(msg);
      hubot.messageRoom(room, msg);
    }}});
  });

  hubot.respond(/deploy ([a-zA-Z]+)\/([a-zA-Z]+)(?:#*)([a-zA-Z]*)/i, function(message) {
    var user = message.match[1];
    var repo = message.match[2];
    var branch = message.match[3];
    deploy({ user:user, repo:repo, branch:branch, res:{ send: function(msg) {
      message.send(msg);
      console.log(msg);
      hubot.messageRoom(room, msg);
    }}});
  });
};

function deploy(options) {
  var res = options.res;
  var user = options.user;
  var repo = options.repo;
  var branch = options.branch;
  var prod = options.prod;
  var server = options.server;
  var key = user+'/'+repo+'#'+branch;

  if (deploySync[key]) return;
  deploySync[key] = true;

  if (!env.get(user+'/'+repo)) {
    res.send(user+'/'+repo+' not found in config');
    delete deploySync[key];
    return;
  }

  var restricted = env.get(user+'/'+repo+':restricted');
  if (restricted && restricted.indexOf(branch) !== -1) {
    res.send(user+'/'+repo+' push to restricted branch: '+branch);
    delete deploySync[user+repo+branch];
    return;
  }
  res.send('Deploying '+key+(prod ? ' to PRODUCTION' : ''));

  var destination = (branch&&branch+'-')+env.get(user+'/'+repo+':server:dev');
  if (branch === 'master' && prod)
    destination = env.get(user+'/'+repo+':server:prod');
  else if (branch === 'master')
    destination = 'stg-'+env.get(user+'/'+repo+':server:prod');

  var ci = new CircleCI({
    'auth': env.get(user+'/'+repo+':ciToken')
  });

  return ci.getBuilds({
    'username': user,
    'project': repo
  })
  .then(function(builds) {
    if (builds.message === 'Project not found') throw 'ciToken invalid';

    var build = builds.filter && builds.filter(function(d) {
      return d.branch === branch && d.outcome === 'success';
    }).shift();

    if (!build) throw 'Failed to find successful build';

    return build;
  })
  .then(function(build) {
    return new Promise(function(resolve, reject) {
      ci.getBuildArtifacts({
        'username': user,
        'project': repo,
        'build_num': build.build_num
      }).then(function(artifacts) {
        resolve([artifacts, build]);
      });
    });
  })
  .spread(function(artifacts, build) {
    if (!artifacts || !artifacts.length) throw 'Failed to find artifacts';

    var sha = build.vcs_revision;
    var buildNumber = build.build_num;

    return artifacts.filter(function(artifact) {
      // TODO: filter out just the build artifacts
      return true;
    }).map(function(artifact) {
      var name = artifact.pretty_path.split('/').pop();
      var nameParts = name.split('-');
      var component = nameParts[0];
      var buildEnv = nameParts[1];
      return {
        'url': artifact.url + '?circle-token=' + env.get(user+'/'+repo+':ciToken'),
        'build': buildNumber,
        'sha': sha,
        'component': component,
        'env': buildEnv
      };
    });
  })
  .then(function(artifacts) {
    var artifact = artifacts.pop();
    if (!artifact) throw 'Could not find necessary artifacts';
    return artifact;
  })
  .then(function(artifact) {
    return execAsync([
      './bin/deploy.sh',
      server || destination,
      destination,
      artifact.build,
      artifact.url,
      artifact.sha,
    ].join(' '));
  })
  .then(function(output) {
    res.send('Deployed: '+destination);
    delete deploySync[key];
  })
  .catch(function(err) {
    res.send('Deployment failed: '+err);
    delete deploySync[key];
  });
}
