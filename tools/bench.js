var fs = require('fs'),
    http = require('http');

var http_load = require('http_load'),
    engine = require('bench_engine.js');

var HTTP_LOAD_PARALLEL = 5,
    HTTP_LOAD_SECONDS = 20,//180,
    COMMENT_POST_PER_MIN_MAIN = 30,
    COMMENT_POST_PER_MIN_OPT = 10,
    COMMENT_SIZE = 200;

var COMMENT_POST_INTERVALS = Math.floor(60 * 1000 / (COMMENT_POST_PER_MIN_MAIN + COMMENT_POST_PER_MIN_OPT));
var CHEKCER_START_DURATION = Math.floor(HTTP_LOAD_SECONDS / 3) * 1000;

var conf = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf-8'));

var teamid = process.argv[2],
    target = conf.teams[teamid].target,
    targetHost = target.split(':')[0],
    targetPort = target.split(':')[1];

var continuousMode = false;
if (process.argv.length > 3 && process.argv[3] === 'inf') {
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
      engine.postArticle({
        hostname:targetHost, portnum:targetPort, articlesize:1000, articleid:articleId
      }, function(err, articleid, data){
        if (err){ console.log('failed to post new article'); process.exit(1); }
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

  setTimeout(function(){checker(articleid, data, function(r){checker_result = r;});}, CHEKCER_START_DURATION);

  var posterId = setInterval(function(){
    commentposter(articleid, function(r){poster_result = (poster_result && r);});
  }, COMMENT_POST_INTERVALS);

  http_load.start(dirpath + '/urls', {parallel: HTTP_LOAD_PARALLEL, seconds: HTTP_LOAD_SECONDS}, function(err, result){
    if (err) { console.log('error on http_load'); console.log(err); }
    clearInterval(posterId);
    output(dirpath, result, checker_result, function(err){
      if (loading && continuousMode)
        process.nextTick(function(){
          prepare(load);
        });
      else
        process.exit(0);
    });
  });
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
          var bodylines = body.split('\n');
          if (bodylines[bodylines.length - 1].length < 1)
            bodylines.pop();
          var bodyText = body.join('\n');
          var success = false;
          $('.comment').each(function(index, element){
            var c = $(element);
            if (c.children('.name').text() == nameLabel){
              var gotlines = c.children('.body').html().split('<br ?/?>');
              if (gotlines[gotlines.length - 1].length < 1)
                gotlines.pop();
              if (bodyText === gotlines.join('\n'))
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

function output(dirpath, load_result, checker_result, callback){
  var totalresponse = Number(load_result.response.success) + Number(load_result.response.error);
  var load_test = (Number(load_result.response.error) < totalresponse * 0.01);
  var test = load_test && (checker_result.summary === 'success');
  var score = Number(load_result.response.success);

  var data = {teamid: teamid, resulttime: (new Date()), test:test, score:score, bench: load_result, checker: checker_result};
  fs.writeFileSync(dirpath + '/result' + (new Date()).getTime(), JSON.stringify(data, null, '\t') + '\n', 'utf8');
  var req = http.request({
    host: conf.master.host.split(':')[0],
    port: conf.master.host.split(':')[1],
    method: 'POST',
    path: '/result/' + teamid,
    headers: {'Content-Type': 'application/json', 'User-Agent': 'ISUCon bench agent v1.0'}
  }, function(res){
    callback(null);
  });
  req.on('error', function(err){
    callback(err);
  });
  req.write(JSON.stringify(data) + '\n');
  req.end();
};

prepare(load);
