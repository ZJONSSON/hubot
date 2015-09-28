var CircleCI = require('circleci');
var Promise = require('bluebird');
var execAsync = Promise.promisify(require('child_process').exec);
var env = require('nconf').argv().env().file('default', 'config.json');
var deploySync = {};

module.exports = function(hubot) {
  hubot.router.post('/hubot/deploy', function(req, res) {
    var user = req.body.payload.username;
    var repo = req.body.payload.reponame;
    var branch = req.body.payload.branch;
    res.send('OK');
    deploy({ user:user, repo:repo, branch:branch, res:{send:function(){}} });
  });

  hubot.respond(/deploy ([a-zA-Z]+)\/([a-zA-Z]+)(?:#*)([a-zA-Z]*)/i, function(message) {
    var user = message.match[1];
    var repo = message.match[2];
    var branch = message.match[3];
    deploy({ user:user, repo:repo, branch:branch, res:message });
  });
};

function deploy(options) {
  var user = options.user;
  var repo = options.repo;
  var branch = options.branch;
  var res = options.res;

  if (deploySync[user+repo+branch]) return;
  deploySync[user+repo+branch] = true;

  if (!env.get(user+'/'+repo)) {
    console.log(user+'/'+repo+' not found in config');
    res.send(user+'/'+repo+' not found in config');
    delete deploySync[user+repo+branch];
    return;
  }
  
  console.log('Deploying '+user+'/'+repo+'#'+branch);
  res.send('Deploying '+user+'/'+repo+'#'+branch);

  var ci = new CircleCI({
    'auth': env.get(user+'/'+repo+':ciToken')
  });

  return ci.getBuilds({
    'username': user,
    'project': repo
  })
  .then(function(builds) {
    var build = builds.filter(function(d) {
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
    return execAsync([
      './bin/deploy.sh',
      env.get(user+'/'+repo+':server'),
      artifact.build,
      artifact.url,
      artifact.sha,
      (branch&&branch+'.')+env.get(user+'/'+repo+':server')
    ].join(' '));
  })
  .then(function(output) {
    res.send(user+'/'+repo+(branch&&'#'+branch)+' deployed: ' +
      (branch&&branch+'.')+env.get(user+'/'+repo+':server'));
    console.log(user+'/'+repo+(branch&&'#'+branch)+' deployed: ' +
      (branch&&branch+'.')+env.get(user+'/'+repo+':server'));
    delete deploySync[user+repo+branch];
  })
  .catch(function(err) {
    console.error('Deployment failed');
    console.log(err);
    res.send('Deployment failed: ' + err);
    delete deploySync[user+repo+branch];
  });
}
