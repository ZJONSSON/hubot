var CircleCI = require('circleci');
var Promise = require('bluebird');
var execAsync = Promise.promisify(require('child_process').exec);
var env = require('nconf').argv().env().file('default', 'config.json');

module.exports = function(hubot) {
  hubot.router.post('/hubot/deploy', function(req, res) {
    var user = req.body.payload.username;
    var repo = req.body.payload.reponame;
    var branch = req.body.payload.branch;
    deploy({ user:user, repo:repo, branch:branch, res:res });
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

  if (!env.get(user+'/'+repo)) {
    console.log(user+'/'+repo+' not found in config');
    return res.send(user+'/'+repo+' not found in config');
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
    }).pop();

    if (!build) throw 'Failed to find successful build';

    return build;
  })
  .then(function(build) {
    var artifacts = ci.getBuildArtifacts({
      'username': user,
      'project': repo,
      'build_num': build.build_num
    });

    return [artifacts, build];
  })
  .spread(function(artifacts, build) {
    if (!artifacts || !artifacts.length) throw 'Failed to find artifacts';

    var sha = build.vcs_revision;
    var buildNumber = build.build_num;

    var uploadable = artifacts.filter(function(artifact) {
      // TODO: filter out just the build artifacts
      return true;
    }).map(function(artifact) {
      var name = artifact.pretty_path.split('/').pop();
      var nameParts = name.split('-');
      var component = nameParts[0];
      var buildEnv = nameParts[1];
      return {
        'url': artifact.url + '?circle-token=' + ciToken,
        'build': buildNumber,
        'sha': sha,
        'component': component,
        'env': buildEnv
      };
    });
    return uploadable;
  })
  .then(function(artifacts) {
    console.log(artifacts)
    if (!artifact) throw 'Could not find necessary artifacts';
    var artifact = artifacts.pop();
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
    console.log(output);
    res.send(user+'/'+repo+(branch&&'#'+branch)+' deployed: ' +
      (branch&&branch+'.')+env.get(user+'/'+repo+':server'));
    if (output.join('').indexOf('SHA OK') === -1) {
      res.send(user+ + '/' + branch + ' failed verification');
    }
  })
  .catch(function(err) {
    console.error('Deployment failed');
    console.log(err);
    res.send('Deployment failed: ' + err);
  });
}
