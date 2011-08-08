var express = require('express'),
    jade = require('jade'),
    mysql = require('mysql'),
    app = express.createServer();

function error_handle(req, res, err){
  console.log(err);
  console.log(err.stack);
  res.send(err, 500);
};

var dbclient = mysql.createClient({
  host: 'localhost',
  port: 3306,
  user: 'isuconapp',
  password: 'isunageruna',
  database: 'isucon'
});

app.configure(function(){
  app.use(express.logger('default'));
  app.use(express.methodOverride());
  app.use(express.bodyParser());

  app.set('view engine', 'jade');

  app.use(express.static(__dirname + '/public'));
  app.use(express.errorHandler());

  app.use(app.router);
});

var SIDEBAR_ARTICLES_QUERY = function(){
  return 'SELECT article FROM comment GROUP BY article ORDER BY created_at DESC LIMIT 10';
};
var SIDEBAR_DATA_QUERY = function(articles){
  if (articles < 1) {
    throw new RangeError('SIDEBAR needs 1 or more articles');
  }
  if (articles > 10) {
    throw new RangeError('SIDEBAR floods with 11 or more articles');
  }
  var whereclauseparts = [];
  for (var i = 0; i < articles; i++) {
    whereclauseparts = whereclauseparts.concat(['id=?']);
  }
  return 'SELECT id,title FROM article WHERE ' + whereclauseparts.join(' OR ');
};

function IsuException(message) {
   this.message = message;
   this.name = "IsuException";
};

var SIDEBAR_ARTICLES_TEMPLATE = 'table\n  - each item in sidebaritems\n    tr\n      td\n        a(href="/article/#{item.id}") #{item.title}';
var sidebarGenerator = jade.compile(SIDEBAR_ARTICLES_TEMPLATE);

function loadSidebarData(callback){
  dbclient.query(SIDEBAR_ARTICLES_QUERY(), function(err, results){
    if (err) {callback(new IsuException('failed to select recently commented article ids.')); return;}
    var sidebarArticleIds = results.map(function(v){return v.article;});
    if (sidebarArticleIds.length < 1) {
      callback(null, '<table><tr><td>none</td></tr></table>');
      return;
    }
    dbclient.query(SIDEBAR_DATA_QUERY(sidebarArticleIds.length), sidebarArticleIds, function(err, results){
      if (err) {callback(new IsuException('failed to select article data for sidebar.')); return;}
      callback(null, sidebarGenerator.call(this, {sidebaritems: results}));
    });
  });
};

app.get('/', function(req, res){
  var toppage_query = 'SELECT id,title,body,created_at FROM article ORDER BY id DESC LIMIT 10';
  loadSidebarData(function(err, sidebarHtml){
    if (err) {error_handle(req, res, err); return;}
    dbclient.query(toppage_query, function(err, results){
      if (err) {error_handle(req, res, err); return;}
      res.render('index', {sidebar: sidebarHtml, articles: results});
    });
  });
});

app.get('/post', function(req, res){
  loadSidebarData(function(err, sidebarHtml){
    if (err) {error_handle(req, res, err); return;}
    res.render('post');
  });
});

app.post('/post', function(req, res){
  var title = req.body.title;
  var body = req.body.body;
  // do INSERT and res.redirect ....
});

app.listen(5000);
