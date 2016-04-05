/*
  Description:
    Hubot deploy script

  Configuration:
    HUBOT_SSH_KEY - `heroku config:set HUBOT_SSH_KEY="$(echo id_rsa)"`
    config.json - {
      "username/reponame": {
        "releaseBranch": "master",
        "restrictedBranches": [ "stg" ],
        "server": {
          "dev": "-dev.myhost.com",
          "prod": "myhost.com"
        },
        "ciToken": "",
        "rollbarToken": ""
      }
    }

  Commands:
    hubot deploy user/repo#branch
    hubot deploy user/repo to prod
    post(/hubot/deploy, { payload: { username: '', reponame: '', branch: '' }, prod: Boolean, server: String })
*/

var env = require('nconf').argv().env().file('default', 'config.json');
var room = 'engineering-git';

var CircleCI = require('circleci');
var Promise = require('bluebird');
var execAsync = Promise.promisify(require('child_process').exec);
var deploySync = {};
var takedownSync = {};

module.exports = function(hubot) {
  hubot.router.post('/hubot/takedown', function(req, res) {
    var repo = req.body.repository && req.body.repository.full_name;
    var branch = req.body.ref && req.body.ref.replace(/refs\/heads\//,'');
    takedown({ repo:repo, branch:branch, res:{ send:function(msg) {
      console.log(msg);
      hubot.messageRoom(room, msg);
    }}});
    res.send('OK');
  });
  hubot.respond(/takedown (\S[^\/]+)\/(\S[^#\s]+)(?:#*)(\S*)/i, function(message) {
    var user = message.match[1];
    var repo = message.match[2];
    var branch = message.match[3];
    takedown({ repo:user+'/'+repo, branch:branch, res:{ send:function(msg) {
      console.log(msg);
      hubot.messageRoom(room, msg);
      if (message.envelope.room !== room) message.send(msg);
    }}});
  });
  hubot.respond(/build (\S[^\/]+)\/(\S[^#\s]+)(#*\S*)([\S\s]*)/i, function(message) {
    var user = message.match[1];
    var repo = message.match[2];
    var branch = message.match[3] && message.match[3].replace(/#/g,'');
    var cache = message.match[4] && message.match[4].indexOf('cache') > -1;
    var ci = new CircleCI({'auth': env.get(user+'/'+repo+':ciToken') });
    (cache ? ci.clearBuildCache({username:user,project:repo}) : Promise.resolve())
      .then(function() {
        return ci.startBuild({ username: user, project: repo, branch: branch });
      }).then(function(build) {
        var msg = 'Building'+(cache?' without cache':'')+': '+build.build_url;
        console.log(msg);
        hubot.messageRoom(room, msg);
        if (message.envelope.room !== room) message.send(msg);
      }).catch(function(err) {
        console.log(err);
        hubot.messageRoom(room, err);
        if (message.envelope.room !== room) message.send(msg);
      });
  });

  hubot.router.post('/hubot/deploy', function(req, res) {
    var user = req.body.payload.username;
    var repo = req.body.payload.reponame;
    var branch = req.body.payload.branch;
    var server = req.body.server;
    var prod = req.body.prod;
    if (req.body.payload.failed) {
      var msg = 'Build failed for '+user+'/'+repo+'#'+branch+' '+req.body.payload.build_url;
      if (req.body.payload.why === 'retry') {
        console.log(msg);
        hubot.messageRoom(room, msg);
      } else {
        var ci = new CircleCI({'auth': env.get(user+'/'+repo+':ciToken') });
        ci.clearBuildCache({ username: user, project: repo }).then(function() {
          return ci.retryBuild({ username: user, project: repo, build_num: req.body.payload.build_num });
        }).then(function(build) {
          msg += '\nRetrying without cache ' + build.build_url;
          console.log(msg);
          hubot.messageRoom(room, msg);
        });
      }
    } else {
      deploy({ user:user, repo:repo, branch:branch, server:server, prod:prod, res:{ send:function(msg) {
        console.log(msg);
        hubot.messageRoom(room, msg);
      }}});
    }
    res.send('OK');
  });
  hubot.respond(/deploy (\S[^\/]+)\/(\S[^#\s]+)(#*\S*)([\S\s]*)/i, function(message) {
    var user = message.match[1];
    var repo = message.match[2];
    var branch = message.match[3];
    var prod = message.match[4] && message.match[4].indexOf('to prod') > -1;
    deploy({ user:user, repo:repo, branch:branch, prod:prod, res:{ send: function(msg) {
      console.log(msg);
      hubot.messageRoom(room, msg);
      if (message.envelope.room !== room) message.send(msg);
    }}});
  });
};

function deploy(options) {
  var res = options.res;
  var user = options.user;
  var repo = options.repo;
  var releaseBranch = env.get(user+'/'+repo+':releaseBranch');
  var branch = (options.branch || releaseBranch).replace(/([^\w\d\s-])/,'');
  var cores = env.get(user+'/'+repo+':cores:'+branch);
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

  if (!releaseBranch) {
    res.send('No release branch for '+user+'/'+repo);
    delete deploySync[key];
    return;
  }

  var restricted = env.get(user+'/'+repo+':restrictedBranches');
  if (restricted && restricted.indexOf(branch) !== -1) {
    res.send(user+'/'+repo+' push to restricted branch: '+branch);
    delete deploySync[key];
    return;
  }

  if (prod && branch !== releaseBranch) {
    res.send('Sorry, '+branch+' is not authorized for release to production');
    delete deploySync[key];
    return;
  }

  res.send('Deploying '+key+(prod?' to PRODUCTION':'')+(server?' via '+server:''));
  
  var destination;
  if (prod && branch === releaseBranch) {
    destination = env.get(user+'/'+repo+':server:prod');
    server = server || destination;
    if (env.get(user+'/'+repo+':server:prod2'))
      destination += ',' + env.get(user+'/'+repo+':server:prod2');
  }
  else if (branch === releaseBranch)
    destination = env.get(user+'/'+repo+':server:stg');
  else if (env.get(user+'/'+repo+':server:'+branch))
    destination = env.get(user+'/'+repo+':server:'+branch);
  else
    destination = branch+env.get(user+'/'+repo+':server:dev');

  var NODE_ENV = (branch === releaseBranch) ? 'production' : 'development';

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
      NODE_ENV,
      cores
    ].join(' ')).then(function() { return artifact; });
  })
  .then(function(artifact) {
    if (!env.get(user+'/'+repo+':rollbarToken'))
      return res.send('rollbarToken missing for '+user+'/'+repo);
    return execAsync([
      './bin/rollbar.sh',
      env.get(user+'/'+repo+':rollbarToken'),
      branch === releaseBranch ? (prod?'production':'staging') : branch,
      artifact.sha
    ].join(' '));
  })
  .then(function() {
    res.send('Deployed: '+destination);
    delete deploySync[key];
  })
  .catch(function(err) {
    res.send('Deployment failed: '+err);
    delete deploySync[key];
  });
}

function takedown(options) {
  var res = options.res;
  var repo = options.repo;
  var branch = options.branch.replace(/([^\w\d\s-])/,'');
  var key = repo + '#' + branch;
  if (takedownSync[key]) return;
  takedownSync[key] = true;

  if (!env.get(repo)) {
    res.send(repo+' not found in config');
    delete takedownSync[key];
    return;
  }
  if (!branch) {
    res.send('Specify a branch for ' + repo);
    delete takedownSync[key];
    return;
  }
  if (branch === 'master') {
    res.send('What are you trying to pull?');
    delete takedownSync[key];
    return;
  }

  var destination = branch+env.get(repo+':server:dev');

  execAsync([
    './bin/takedown.sh',
    destination
  ].join(' ')).then(function(output) {
    res.send('Took down ' + key); 
    delete takedownSync[key];
  }).catch(function(err) {
    res.send('Error taking down ' + key + ' : ' + err); 
    delete takedownSync[key];
  });
}
