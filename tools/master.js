var express = require('express'),
    jade = require('jade'),
    mysql = require('mysql'),
    app = express.createServer();

var ISUCON_TEAMS = [
  {id:'team01',name:'team01'}, {id:'team02',name:'team02'}, {id:'team03',name:'team03'}, {id:'team04',name:'team04'},
  {id:'team05',name:'team05'}, {id:'team06',name:'team06'}, {id:'team07',name:'team07'}, {id:'team08',name:'team08'},
  {id:'team09',name:'team09'}, {id:'team10',name:'team10'}, {id:'team11',name:'team11'}, {id:'team12',name:'team12'},
  {id:'team13',name:'team13'}, {id:'team14',name:'team14'}, {id:'team15',name:'team15'}, {id:'team16',name:'team16'},
  {id:'team17',name:'team17'}, {id:'team18',name:'team18'}, {id:'team19',name:'team19'}, {id:'team20',name:'team20'},
  {id:'team21',name:'team21'}
];

function error_handle(req, res, err){
  console.log(err);
  console.log(err.stack);
  res.send(err, 500);
};

function formatDate(d){
  var pad = function(n){return n < 10 ? '0' + n : n;};
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    + ' '
    + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
};

var dbclient = mysql.createClient({
  host: 'localhost',
  port: 3306,
  user: 'isuconmaster',
  password: 'isunagero',
  database: 'isuconmaster'
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

function IsuException(message) {
   this.message = message;
   this.name = "IsuException";
};

app.get('/', function(req, res){
  res.render('index', {teams:ISUCON_TEAMS});
});

app.get('/status/:id', function(req, res){
  res.send({/* team status json object */});
});

app.get('/latest/:id', function(req, res){
  // latest result details
});

app.get('/history', function(req, res){
  res.send({/* team success score history json object */});
});

app.post('/result/:id', function(req, res){
  // register result from bench tool
});

app.post('/bench/start/:id', function(req, res){
  // start one-time or inf
  // with pass
});

app.post('/bench/stop/:id', function(req, res){
  // stop gracefully(USR1) or just now(HUP)
  // with pass
});

app.listen(3080);
