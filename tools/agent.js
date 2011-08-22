var express = require('express'),
    jade = require('jade'),
    mysql = require('mysql'),
    async = require('async'),
    fs = require('fs'),
    child = require('child_process'),
    app = express.createServer();

var conf = JSON.parse(fs.readFileSync(__dirname + '/config.json'));

function error_handle(req, res, err){
  console.log(err);
  console.log(err.stack);
  res.send(err, 500);
};

app.configure(function(){
  app.use(express.logger('default'));
  app.use(express.methodOverride());
  app.use(express.bodyParser());

  app.use(express.errorHandler());
  app.use(app.router);
});

var executings = {};

app.get('/bench/check/:teamid', function(req, res){
  var teamid = req.params.teamid;
  if (executings[teamid]) {
    child.exec('ps -p ' + executings[teamid].pid + ' | wc -l', function(err, stdout, stderr){
      if (Number(stdout.trim()) === 2)
        res.send('running');
      else {
        delete executings[teamid];
        res.send(404);
      }
    });
  }
  else
    res.send(404);
});

app.post('/bench/start/:teamid', function(req, res){
  var teamid = req.params.teamid;
  var infmode = req.body.infmode;
  var key = req.body.key;
  var pass = req.body.pass;
  if (conf.master.pass === key && conf.teams[teamid].pass === pass) {
    if (! executings[teamid]){
      var benchCmd = __dirname + '/etc/bench.sh ' + teamid + (infmode ? ' inf' : '');
      executings[teamid] = child.exec(benchCmd, function(err, stdout, stderr){
        delete executings[teamid];
      });
      res.send('ok');
    }
    else
      res.send(400);
  }
  else
    res.send(403);
});

app.post('/bench/stop/:teamid', function(req, res){
  var teamid = req.params.teamid;
  var gracefully = req.body.gracefully;
  var key = req.body.key;
  var pass = req.body.pass;
  if (conf.master.pass === key && conf.teams[teamid].pass === pass) {
    if (executings[teamid]) {
      if (gracefully)
        executings[teamid].kill('SIGUSER1');
      else
        executings[teamid].kill('SIGHUP');
      res.send('ok');
    }
    else {
      res.send('ok');
    }
  }
  else
    res.send(403);
});

app.listen(3101);
