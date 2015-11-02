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
var request = require('request');

module.exports = function(hubot) {

  function sendMessage(message, msg) {
    console.log(msg);
    hubot.messageRoom(room, msg);
    if (message && message.envelope && message.envelope.room !== room)
      message.send(msg);
  }

  function pingdome() {
    [].concat(hubot.brain.get('pings')).forEach(function(url) {
      request(url, function(err, res, body) {
        if (err) sendMessage(null, 'Error contacting: ' + url + '  ' + err);
        else if ([200,403,"200","403"].indexOf(res.statusCode) < 0)
          sendMessage(null, url + ' is DOWN!  statusCode:' + res.statusCode);
      });
    });
  }

  setInterval(pingdome, interval);

  hubot.respond(/add ping (\S+)/i, function(message) {
    var url = message.match[1];
    var pings = [].concat(hubot.brain.get('pings'));
    if (pings.filter(function(d) { return d === url; }).length) {
      sendMessage(message, 'ping already added: ' + url);
    } else {
      pings.push(url);
      hubot.brain.set('pings', pings);
      hubot.brain.save();
      sendMessage(message, 'added ping: ' + url);
    }
  });
  hubot.respond(/remove ping (\S+)/i, function(message) {
    var url = message.match[1];
    var pings = [].concat(hubot.brain.get('pings'));
    var len = pings.length;
    pings = pings.filter(function(d) { return d !== url; }); 
    if (pings.length < len) {
      hubot.brain.set('pings', pings);
      hubot.brain.save();
      sendMessage(message, 'removed ping: ' + url);
    } else {
      sendMessage(message, 'ping not found or removed: ' + url);
    }
  });
  hubot.respond(/list pings/i, function(message) {
    sendMessage(message, [].concat(hubot.brain.get('pings')).join(' '));
  });

};
