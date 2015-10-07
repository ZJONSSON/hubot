/*
  Description:
    Hubot uptime monitor / pingdom script

  Configuration:

  Commands:
    hubot add ping url
    hubot remove ping url
    hubot list ping(s)
*/

var room = 'engineering-git';
var interval = 60000;
var Promise = require('bluebird');
var request = require('request');

module.exports = function(hubot) {

  setInterval(pingdome.bind(null, hubot), interval);

  hubot.respond(/add ping (\S+)/i, function(message) {
    var url = message.match[1];
    var pings = hubot.brain.get('pings') || [];
    if (pings.filter(function(d) { return d === url; }).length) {
      console.log('ping already added: ' + url);
      hubot.messageRoom('ping already added: ' + url);
    } else {
      pings.push(url);
      hubot.brain.set('pings', pings);
      hubot.brain.save();
      console.log('added ping: ' + url);
      hubot.messageRoom(room, 'added ping: ' + url);
    }
  });
  hubot.respond(/remove ping (\S+)/i, function(message) {
    var url = message.match[1];
    var pings = hubot.brain.get('pings') || [];
    var len = pings.length;
    pings = pings.filter(function(d) { return d !== url; }); 
    if (pings.length < len) {
      hubot.brain.set('pings', pings);
      hubot.brain.save();
      console.log('removed ping: ' + url);
      hubot.messageRoom(room, 'removed ping: ' + url);
    } else {
      console.log('ping not found or removed: ' + url);
      hubot.messageRoom('ping not found or removed: ' + url);
    }
  });
  hubot.respond(/list ping(s?)/i, function(message) {
    console.log(JSON.stringify(hubot.brain.get('pings') || []));
    hubot.messageRoom(JSON.stringify(pings));
  });

};

function pingdome(hubot) {
  (hubot.brain.get('pings') || []).forEach(function(url) {
    request(url, function(err, res, body) {
      if ([200,403,"200","403"].indexOf(res.statusCode) < 0) {
        console.log(url + ' is DOWN!');
        hubot.messageRoom(room, url + ' is DOWN!');
      }
    });
  });
}
