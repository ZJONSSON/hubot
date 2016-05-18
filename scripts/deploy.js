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
          "dev": ["-dev.myhost.com"],
          "stg": ["stg.myhost.com","stg.myhost.io"],
          "prod": ["myhost.com","myhost.io"]
        },
        "ciToken": "",
        "rollbarToken": ""
      }
    }

  Commands:
    hubot deploy user/repo#branch
    hubot deploy user/repo to prod
    post(/hubot/deploy, { payload: { username: '', reponame: '', branch: '' },
     prod: Boolean, server: String })
*/

var env = require('nconf').argv().env().file('default', 'config.json');
var room = 'engineering-git';

var CircleCI = require('circleci');
var Promise = require('bluebird');
var execAsync = Promise.promisify(require('child_process').exec);
var deploySync = {};
var takedownSync = {};
var testSync = {};

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

  hubot.respond(/test (\S[^\/]+)\/(\S[^#\s]+)(#*\S*)([\S\s]*)/i, function(message) {
    var user = message.match[1];
    var repo = message.match[2];
    var branch = message.match[3] && message.match[3].replace(/#/g,'');
    var extra = message.match[4] && message.match[4].indexOf('extra') > -1;
    test({ user:user, repo:repo, branch:branch, res:{ send:function(msg) {
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
    deploy({ user:user, repo:repo, branch:branch, prod:prod, res:{ send:function(msg) {
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
  var prod = options.prod;
  var server = options.server;
  var key = user+'/'+repo+'#'+branch;
  var dockertag = user+'/'+repo+':'+branch;
  var logtag = 'app/'+user+'-'+repo+'/'+branch+'/';

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
  var servers = env.get(user+'/'+repo+':server');
  if (prod && branch === releaseBranch) {
    server = server || servers.prod[0];
    destination = servers.prod.join(',');
  }
  else if (branch === releaseBranch) {
    server = server || servers.stg[0];
    destination = servers.stg.join(',');
  }
  else {
    server = server || branch + servers.dev[0];
    destination = servers.dev.map(function(d) { return branch + d; }).join(',');
  }

  var NODE_ENV = (branch === releaseBranch) ? 'production' : 'development';

  return getArtifacts({
    user: user,
    repo: repo,
    branch: branch
  })
  .then(function(artifacts) {
    return execAsync([
      './bin/deploy.sh',
      server,
      destination,
      artifacts.dist.buildNumber,
      artifacts.dist.url,
      artifacts.dist.sha,
      NODE_ENV,
      dockertag,
      logtag + artifacts.dist.sha
    ].join(' ')).then(function(res) {
      if (String(res).toLowerCase().indexOf('error')>-1) throw 'Deploy failed:\n'+res;
      return artifacts;
    });
  })
  .then(function(artifacts) {
    if (!env.get(user+'/'+repo+':rollbarToken'))
      return res.send('rollbarToken missing for '+user+'/'+repo);
    return execAsync([
      './bin/rollbar.sh',
      env.get(user+'/'+repo+':rollbarToken'),
      branch === releaseBranch ? (prod?'production':'staging') : branch,
      artifacts.dist.sha
    ].join(' ')).then(function() { return artifacts; });
  })
  .then(function(artifacts) {
    res.send('Deployed: '+destination);
    if (!env.get(user+'/'+repo+':test:'+branch))
      return;
    res.send('Testing: '+destination);
    return execAsync([
      './bin/test.sh',
      artifacts.src.url,
      artifacts.src.sha,
      server,
      NODE_ENV,
      repo
    ].join(' ')).then(function(resp) {
      if (String(resp).toLowerCase().indexOf('error')>-1)
        throw 'Test failed for '+destination+' \n'+resp;
      res.send('Test passed for '+destination);
    }).catch(function(err) { throw 'Test failed for '+destination+' \n'+err; });
  })
  .then(function() {
    delete deploySync[key];
  })
  .catch(function(err) {
    res.send('Deployment failed: '+err);
    delete deploySync[key];
  });
}

function test(options) {
  var res = options.res;
  var user = options.user;
  var repo = options.repo;
  var releaseBranch = env.get(user+'/'+repo+':releaseBranch');
  var branch = (options.branch || releaseBranch).replace(/([^\w\d\s-])/,'');
  var key = user+'/'+repo+'#'+branch;
  var NODE_ENV = (branch === releaseBranch) ? 'production' : 'development';
  var server;
  var servers = env.get(user+'/'+repo+':server');
  if (prod && branch === releaseBranch)
    server = server || servers.prod[0];
  else if (branch === releaseBranch)
    server = server || servers.stg[0];
  else
    server = server || branch + servers.dev[0];

  if (testSync[key]) return;
  testSync[key] = true;

  if (!env.get(user+'/'+repo)) {
    res.send(user+'/'+repo+' not found in config');
    delete testSync[key];
    return;
  }
  return getArtifacts({
    user: user,
    repo: repo,
    branch: branch
  })
  .then(function(artifacts) {
    if (!env.get(user+'/'+repo+':test:'+branch))
      return;
    res.send('Testing: '+destination);
    return execAsync([
      './bin/test.sh',
      artifacts.src.url,
      artifacts.src.sha,
      destination,
      NODE_ENV,
      repo
    ].join(' ')).then(function(res) {
      if (String(res).toLowerCase().indexOf('error')>-1)
        throw res;
    });
  })
  .then(function() {
    res.send('Test passed for '+destination);
    delete testSync[key];
  })
  .catch(function(err) {
    res.send('Test failed for '+destination+': \n'+err);
    delete testSync[key];
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

  var destination = branch+env.get(repo+':server:dev')[0];

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

function getArtifacts(options) {
  var ci = new CircleCI({'auth':env.get(options.user+'/'+options.repo+':ciToken')});
  return ci.getBuilds({
    'username': options.user,
    'project': options.repo
  })
  .then(function(builds) {
    if (builds.message === 'Project not found') throw 'ciToken invalid';
    var build = builds.filter && builds.filter(function(d) {
      return d.branch === options.branch && d.outcome === 'success';
    }).shift();
    if (!build) throw 'Failed to find successful build';
    return build;
  })
  .then(function(build) {
    return new Promise(function(resolve, reject) {
      ci.getBuildArtifacts({
        'username': options.user,
        'project': options.repo,
        'build_num': build.build_num
      }).then(function(artifacts) {
        resolve([artifacts, build]);
      });
    });
  })
  .spread(function(artifacts, build) {
    if (!artifacts || !artifacts.length) throw 'Failed to find artifacts';
    return artifacts.filter(function(artifact) {
      return artifact.pretty_path.indexOf(options.repo) > -1;
    }).map(function(artifact) {
      artifact.url = artifact.url + '?circle-token=' +
        env.get(options.user+'/'+options.repo+':ciToken');
      artifact.sha = build.vcs_revision;
      artifact.buildNumber = build.build_num;
      return artifact;
    });
  })
  .then(function(artifacts) {
    if (!artifacts.length)
      throw 'Failed to find necessary artifacts';
    return artifacts.reduce(function(o, d) {
      if (d.pretty_path.indexOf('src') > -1) o.src = d;
      else if (d.pretty_path.indexOf('dist') > -1) o.dist = d;
      return o;
    }, {});
  });
}
