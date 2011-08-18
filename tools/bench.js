var fs = require('fs');

var http_load = require('http_load');
var engine = require('bench_engine.js');

var HTTP_LOAD_PARALLEL = 5;
var HTTP_LOAD_SECONDS = 20;//180;

var COMMENT_POST_PER_MIN_MAIN = 30;
var COMMENT_POST_PER_MIN_OPT = 10;

var COMMENT_SIZE = 200;

var COMMENT_POST_INTERVALS = Math.floor(60 * 1000 / (COMMENT_POST_PER_MIN_MAIN + COMMENT_POST_PER_MIN_OPT));
var CHEKCER_START_DURATION = Math.floor(HTTP_LOAD_SECONDS / 3) * 1000;

var config = JSON.parse(fs.readFileSync(__dirname + '/../webapp/config/hosts.json', 'utf-8'));
var targetHost = config.servers.reverseproxy[0];
var targetPort = config.servers.reverseproxyport || 5000; //80;

var continuousMode = false;
if (process.argv.length > 2 && process.argv[2] === 'inf') {
  continuousMode = true;
}

function prepare(callback){
  engine.getArticle('/', targetHost, targetPort, function(err, content){
    if (err){
      process.exit(1);
    }
    engine.parseHtml(content, function($){
      var latestArticleURI = $('#articleview :eq(0) .articlelink a').attr('href');
      var articleId = 1;
      if (latestArticleURI) {
        var matched = /\/article\/(\d+)$/.exec(latestArticleURI);
        articleId = Number(matched[1]) + 1;
      }
      engine.postArticle({hostname:targetHost, portnum:targetPort, articlesize:1000, articleid:articleId}, function(err, articleid, data){
        if (err){
          process.exit(1);
        }
        engine.generateUrlsFile(targetHost, targetPort, articleid, function(dirpath){
          callback(dirpath, articleid, data);
        });
      });
    });
  });
};

var loading = true;
process.on('SIGUSR1', function(){
  loading = false;
});

function load(dirpath, articleid, data){
  var checker_result = null;
  var poster_result = null;
  http_load.start(dirpath + '/urls', {parallel: HTTP_LOAD_PARALLEL, seconds: HTTP_LOAD_SECONDS}, function(err, result){
    output(dirpath, result, checker_result);
    if (loading && continuousMode)
      process.nextTick(function(){
        prepare(load);
      });
    else
      process.exit(0);
  });
  setTimeout(function(){checker(articleid, data, function(r){checker_result = r;});}, CHEKCER_START_DURATION);
  setInterval(function(){commentposter(articleid, function(r){poster_result = r;});}, COMMENT_POST_INTERVALS);
};

function commentposter(maxArticleId, callback){
  var targetId = maxArticleId;
  var checkContent = false;
  var r = Math.floor(Math.random() * (COMMENT_POST_PER_MIN_MAIN + COMMENT_POST_PER_MIN_OPT));
  if (r > COMMENT_POST_PER_MIN_MAIN)
    targetId = Math.floor(Math.random() * maxArticleId);
  if (Math.random() > 0.8)
    checkContent = true;
  var commentSize = Math.floor(COMMENT_SIZE * (Math.random() + 0.5));
  postCommentAndCheck(targetId, commentSize, checkContent, callback);
};

function postCommentAndCheck(articleid, size, checkContent, callback){
  var spec = {articleid: articleid, size: size, hostname: targetHost, portnum: targetPort};
  engine.postComment(spec, function(err, name, body){
    if (err) { callback(false); return; }
    if (! checkContent) { callback(true); return; }

    setTimeout(function(){
      engine.getArticle('/article/' + articleid, targetHost, targetPort, true, function(err, content){
        if (err) { callback(false); return; }

        engine.parseHtml(content, function($){
          var nameLabel = (name.length < 1 ? '名無しさん' : name);
          var bodyHtml = body.split('\n').join('<br>');
          var success = false;
          $('.comment').each(function(index, element){
            var c = $(element);
            if (c.children('.name').text() == nameLabel && c.children('.body').html().replace('<br>$') == bodyHtml) {
              success = true;
            }
          });
          callback(success);
        });
      });
    }, 1000);
  });
};


function checker(articleid, data, callback){
  checkArticle(articleid, data, function(checkresult){
    if (checkresult.summary !== 'success') {
      callback(checkresult);
      return;
    }
    checkArticle(function(checkresult){
      callback(checkresult);
    });
  });
};

var initialDataSet = require('initialData').Set;
function checkArticle(articleid, data, callback){
  if (articleid !== null && data == null && callback == null) {
    callback = articleid;

    if (initialDataSet.length < 1) {
      callback({summary:'success', articleid:0});
    }
    var article = initialDataSet[Math.floor(Math.random() * initialDataSet.length)];
    articleid = article.id;
    data = article.data;
  }
  engine.getArticle('/article/' + articleid, targetHost, targetPort, true, function(err, content){
    if (err) {
      callback({summary:'error'});
      return;
    }
    engine.parseHtml(content, function($){
      //check of dom
      var checkresult = {};
      checkresult.articleid = articleid;
      checkresult.postlink = ($('#view #titleimage a').attr('href') == '/post');
      checkresult.latestcomments = ($('#mainview #sidebar table tr td').eq(0).text() == '新着コメントエントリ');
      checkresult.title = ($('#articleview .article .title').text() == data.title);
      checkresult.created = (/^\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d$/.exec($('#articleview .article .created').text()) ? true : false);
      checkresult.body = ($('#articleview .article .body').html().replace(/<br>$/, '') == data.body.split('\n').join('<br>'));

      var summary = (checkresult.postlink && checkresult.latestcomments && checkresult.title && checkresult.created && checkresult.body);
      checkresult.summary = (summary ? 'success' : 'fail');
      callback(checkresult);
    });
  });
};

function output(dirpath, result, checker_result){
  var data = JSON.stringify({bench: result, checker: checker_result}, null, '\t') + '\n';
  fs.writeFileSync(dirpath + '/result' + (new Date()).getTime(), data, 'utf8');
};

prepare(load);
