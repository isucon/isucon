var express = require('express'),
    jade = require('jade'),
    mysql = require('mysql'),
    async = require('async'),
    fs = require('fs'),
    http = require('http'),
    app = express.createServer();

var conf = JSON.parse(fs.readFileSync(__dirname + '/config.json'));

function error_handle(req, res, err){
  console.log(err);
  console.log(err.stack);
  res.send(err, 500);
};

function formatDate(d){
  var pad = function(n){return n < 10 ? '0' + n : n;};
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate())
    + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
};

var dbclient = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'isumaster',
  password: 'isunagero',
  database: 'isumaster'
});

app.configure(function(){
  app.use(express.logger('default'));
  app.use(express.methodOverride());
  app.use(express.bodyParser());

  app.set('view engine', 'jade');
  app.set('view options', {layout: false});

  app.use(express.static(__dirname + '/public'));
  app.use(express.errorHandler());

  app.use(app.router);
});

app.get('/', function(req, res){
  res.render('index', {teams:conf.teamlist.map(function(n){return conf.teams[n];})});
});

app.get('/status/:teamid', function(req, res){
  var TEAM_LATEST_RESULT = 'SELECT teamid,resulttime,test,score,bench,checker FROM results WHERE teamid=? ORDER BY resulttime DESC LIMIT 1';
  var TEAM_HIGHEST_RESULT = 'SELECT teamid,resulttime,score,bench FROM results WHERE teamid=? AND test=1 ORDER BY score DESC LIMIT 1';
  var teamid = req.params.teamid;
  var bench = conf.bench[conf.teams[teamid].bench];
  var latest = null;
  var highest = null;
  var running = false;
  async.parallel([
    function(cb){
      dbclient.query(TEAM_LATEST_RESULT, [teamid], function(err, results){
        if (err) { cb(err); return; }
        if (results.length === 1)
          latest = results[0];
        dbclient.query(TEAM_HIGHEST_RESULT, [teamid], function(err, results){
          if (err) { cb(err); return; }
          if (results.length === 1)
            highest = results[0];
          cb(null, 1);
        });
      });
    },
    function(cb){
      // get bench agent status...
      http.get({
        host: bench.split(':')[0],
        port: bench.split(':')[1],
        path: '/bench/check/' + teamid,
        headers: {'User-Agent': 'ISUCon master v1.0'}
      }, function(res){
        if (res.statusCode === 200)
          running = true;
        cb(null, 1);
      }).on('error', function(e){cb(null,1);});
    }
  ], function(err, returns){
    res.send({
      test:(latest && latest.test == 1),
      latest:latest,
      highest:highest,
      running:running
    });
  });
});

app.get('/history', function(req, res){
  var HISTORY_QUERY = 'SELECT teamid,resulttime,score FROM results WHERE test=1 ORDER BY resulttime';
  dbclient.query(HISTORY_QUERY, function(err, results){
    var rows = [];
    results.forEach(function(r){
      var t = r.resulttime.substring(8);
      var secofday = t.substring(0,2) * 3600 + t.substring(2,2) * 60 + t.substring(4);
      rows.push([secofday, r.teamid, r.score]);
    });
    res.send({history:results});
  });
});

app.post('/result/:teamid', function(req, res){
  var teamid = req.params.teamid;
  var resulttime = formatDate(new Date(req.body.resulttime));
  var INSERT_RESULT = 'INSERT INTO results SET teamid=?,resulttime=?,test=?,score=?,bench=?,checker=?';
  var data = [teamid,resulttime,(req.body.test ? 1 : 0),req.body.score,JSON.stringify(req.body.bench),JSON.stringify(req.body.checker)];
  dbclient.query(INSERT_RESULT, data, function(err, results){
    res.send({status:'ok'});
  });
});

var redraw_json = function(json){
  return JSON.stringify(JSON.parse(json), null, '    ');
};

app.get('/latest/:teamid', function(req, res){
  var TEAM_LATEST_RESULT = 'SELECT bench,checker FROM results WHERE teamid=? ORDER BY resulttime DESC LIMIT 1';
  var teamid = req.params.teamid;
  dbclient.query(TEAM_LATEST_RESULT, [teamid], function(err, results){
    if (err) { error_handle(req, res, err); return; }
    if (results.length < 1) {
      res.send({bench:null, checker:null}); return;
    }
    var result = results[0];
    res.send({bench:redraw_json(result.bench), checker:redraw_json(result.checker)});
  });
});

app.get('/highest/:teamid', function(req, res){
  var TEAM_HIGHEST_RESULT = 'SELECT bench,checker FROM results WHERE teamid=? AND test=1 ORDER BY score DESC LIMIT 1';
  var teamid = req.params.teamid;
  dbclient.query(TEAM_HIGHEST_RESULT, [teamid], function(err, results){
    if (err) { error_handle(req, res, err); return; }
    if (results.length < 1) {
      res.send({bench:null, checker:null}); return;
    }
    var result = results[0];
    res.send({bench:redraw_json(result.bench), checker:redraw_json(result.checker)});
  });
});

app.post('/bench/start/:teamid', function(req, res){
  var teamid = req.params.teamid;
  console.log(req.body);
  var infmode = (req.body.infmode && req.body.infmode.length > 0);
  var pass = req.body.pass;
  var key = conf.master.pass;
  var bench = conf.bench[conf.teams[teamid].bench];
  var agentReq = http.request({
    host: bench.split(':')[0],
    port: bench.split(':')[1],
    method: 'POST',
    path: '/bench/start/' + teamid,
    headers: {'Content-Type': 'application/json', 'User-Agent': 'ISUCon master v1.0'}
  }, function(agentRes){
    if (agentRes.statusCode === 200)
      res.send({status:'ok'});
    else {
      if (agentRes.statusCode === 400)
        res.send({status:'already running'}, 400);
      else if (agentRes.statusCode === 403)
        res.send({status:'password mismatch'}, 403);
      else
        res.send({status:'system error'}, 500);
    }
  });
  agentReq.on('error', function(err){
    res.send({status:'bench agent error: ' + err.message}, 500);
  });
  agentReq.write(JSON.stringify({infmode:infmode, key:key, pass:pass}) + '\n');
  agentReq.end();
});

app.post('/bench/stop/:teamid', function(req, res){
  // stop gracefully(USR1) or just now(HUP)
  // with pass
  var teamid = req.params.teamid;
  console.log(req.body);
  var gracefully = (req.body.gracefully && req.body.gracefully.length > 0);
  var pass = req.body.pass;
  var key = conf.master.pass;
  var bench = conf.bench[conf.teams[teamid].bench];
  var agentReq = http.request({
    host: bench.split(':')[0],
    port: bench.split(':')[1],
    method: 'POST',
    path: '/bench/stop/' + teamid,
    headers: {'Content-Type': 'application/json', 'User-Agent': 'ISUCon master v1.0'}
  }, function(agentRes){
    if (agentRes.statusCode === 200)
      res.send({status:'ok'});
    else {
      if (agentRes.statusCode === 403)
        res.send({status:'password mismatch'}, 403);
      else
        res.send({status:'system error'}, 500);
    }
  });
  agentReq.on('error', function(err){
    res.send({status:'bench agent error: ' + err.message}, 500);
  });
  agentReq.write(JSON.stringify({gracefully:gracefully, key:key, pass:pass}) + '\n');
  agentReq.end();
});

app.listen(3080);
