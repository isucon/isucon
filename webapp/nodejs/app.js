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

function IsuException(message) {
   this.message = message;
   this.name = "IsuException";
};

var SIDEBAR_ARTICLES_TEMPLATE = 'table\n  tr\n    td\n      新着コメントエントリ\n  - each item in sidebaritems\n    tr\n      td\n        a(href="/article/#{item.id}") #{item.title}';
var sidebarGenerator = jade.compile(SIDEBAR_ARTICLES_TEMPLATE);

var RECENT_COMMENTED_ARTICLES = 'SELECT a.id, a.title FROM comment c LEFT JOIN article a ON c.article = a.id GROUP BY a.id ORDER BY MAX(c.created_at) DESC LIMIT 10';

var loadSidebarData = function(callback){
  dbclient.query(RECENT_COMMENTED_ARTICLES, function(err, results){
    if (err) {callback(new IsuException('failed to select recently commented article ids.')); return;}
    if (results.length < 1) {
      callback(null, '<table><tr><td>none</td></tr></table>'); return;
    }
    callback(null, sidebarGenerator.call(this, {sidebaritems: results}));
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
  res.render('post');
});

app.post('/post', function(req, res){
  var article_post_query = 'INSERT INTO article SET title=?, body=?';
  var title = req.body.title;
  var body = req.body.body;
  dbclient.query(article_post_query, [title,body], function(err, results){
    if (err) {error_handle(req, res, err); return;}
    res.redirect('/');
  });
});

app.get('/article/:articleid', function(req, res){
  var article_query = 'SELECT id,title,body,created_at FROM article WHERE id=?';
  var comments_query = 'SELECT name,body,created_at FROM comment WHERE article=? ORDER BY id';
  var articleid = req.params.articleid;
  loadSidebarData(function(err, sidebarHtml){
    if (err) {error_handle(req, res, err); return;}
    dbclient.query(article_query, [articleid], function(err, results){
      if (err) {error_handle(req, res, err); return;}
      if (results.length != 1) {
        res.send(404);
        return;
      }
      var article = results[0];
      dbclient.query(comments_query, [articleid], function(err, results){
        if (err) {error_handle(req, res, err); return;}
        res.render('article', {sidebar: sidebarHtml, article: article, comments: results});
      });
    });
  });
});

app.post('/comment/:articleid', function(req, res){
  var comment_post_query = 'INSERT INTO comment SET article=?, name=?, body=?';
  var article = req.params.articleid;
  var name = req.body.name;
  var body = req.body.body;
  dbclient.query(comment_post_query, [article,name,body], function(err, results){
    if (err) {error_handle(req, res, err); return;}
    res.redirect('/article/' + article);
  });
});

app.listen(5000);
