var fs = require('fs'),
    http = require('http'),
    child = require('child_process'),
    async = require('async');

var http_load = require('http_load'),
    engine = require('bench_engine.js');

var HTTP_LOAD_PARALLEL = 10,
    HTTP_LOAD_SECONDS = 60, //180
    COMMENT_POST_PER_MIN_MAIN = 40,
    COMMENT_POST_PER_MIN_OPT = 20,
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

function isValidHtml(content){
  return content.indexOf('<html>') > -1 && content.indexOf('</html>') > -1;
};

function prepare(callback){
  engine.getArticle('/', targetHost, targetPort, function(err, content){
    if (err){ output(null, null, null, null, function(err){process.exit(1); return;}); }
    if (! isValidHtml(content)){ output(null, null, null, null, function(err){ process.exit(1); return;});};

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
        if (err){
          output(null, null, null, null, function(err){process.exit(1); return;});
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
  var poster_result = null; // null(failed) or {summary:'failed'} or {summary:'success'}

  setTimeout(function(){checker(articleid, data, function(r){checker_result = r;});}, CHEKCER_START_DURATION);

  var posterId = setInterval(function(){
    commentposter(articleid, function(r){
      if (poster_result === null || (poster_result.summary === 'success' && r.summary !== 'success'))
        poster_result = r;
      else if (poster_result.summary === 'failed' && r.summary === 'failed') {
        if (! poster_result.reason)
          poster_result.reason = [];
        poster_result.reason = poster_result.reason.concat(r.reason);
      }
    });
  }, COMMENT_POST_INTERVALS);

  http_load.start(dirpath + '/urls', {parallel: HTTP_LOAD_PARALLEL, seconds: HTTP_LOAD_SECONDS}, function(err, result){
    if (err) {
      output(dirpath, {summary:'error on http_load'}, null, null, function(err){process.exit(1); return;});
    }
    clearInterval(posterId);
    output(dirpath, result, checker_result, poster_result, function(err){
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
    targetId = Math.floor(Math.random() * maxArticleId + 1);
  if (Math.random() > 0.8)
    checkContent = true;
  var commentSize = Math.floor(COMMENT_SIZE * (Math.random() + 0.5));
  postCommentAndCheck(targetId, commentSize, checkContent, callback);
};

function checkCommentFrom(name, body, articleid, content, callback){
  if (! isValidHtml(content)) {
    callback({summary:'failed', reason: ['article ' + articleid + ': content is not invalid html, content size:' + content.length]});
    return;
  }
  engine.parseHtml(content, function($){
    var nameLabel = (name.length < 1 ? '名無しさん' : name);
    var bodylines = body.split('\n').map(function(s){return s.trim();});
    while (bodylines[bodylines.length - 1].length < 1)
      bodylines.pop();
    var bodyText = bodylines.join('\n');
    var success = false;
    $('.comment').each(function(index, element){
      if (success) return;
      var c = $(element);
      if (c.children('.name').text() == nameLabel){
        var gotlines = c.children('.body').html().split('\n').map(function(s){return s.trim();}).join('').split(/ *<br ?\/?>\n? */i);
        if (gotlines[0].substring(0,1) === '\n')
          gotlines[0] = gotlines[0].substring(1);
        while (gotlines[gotlines.length - 1].length < 1)
          gotlines.pop();
        if (bodyText === gotlines.join('\n'))
          success = true;
      }
    });
    if (success)
      callback({summary:'success'});
    else
      callback({
        summary:'failed',
        reason:['target /article/' + articleid + ', comment not found, name:' + nameLabel + ', body:' + bodyText]
      });
  });
}

function checkLinkInSidebar(articleid, path, content, callback){
  if (! isValidHtml(content)) {
    callback({summary:'failed', reason: [path + ': content is not invalid html, content size:' + content.length]});
    return;
  }
  engine.parseHtml(content, function($){
    if ($('#sidebar table tr td a')
        .map(function(i,e){return $(e).attr('href');})
        .filter(function(i,e){return e.split('/').pop() == articleid;}).length > 0) {
      callback({summary: 'success'});
    }
    else {
      callback({summary:'failed', reason:['Sidebar update check failed on ' + path + ' after comment posted']});
    };
  });
}

function postCommentAndCheck(articleid, size, checkContent, callback){
  var spec = {articleid: articleid, size: size, hostname: targetHost, portnum: targetPort};
  engine.postComment(spec, function(err, name, body){
    if (err) { callback({summary:'failed', reason:['POST request failed']}); return; }
    if (! checkContent) { callback({summary:'success'}); return; }

    setTimeout(function(){
      async.parallel([
        function(cb){
          engine.getArticle('/article/' + articleid, targetHost, targetPort, true, function(err, content){
            if (err) { cb(null, {summary:'failed', reason:['GET request failed after comment posted']}); return; }
            checkCommentFrom(name, body, articleid, content, function(obj){cb(null, obj);});
          });
        },
        function(cb){
          engine.getArticle('/', targetHost, targetPort, true, function(err, content){
            if (err) { cb(null, {summary:'failed', reason:['GET request of / failed after comment posted']}); return; }
            checkLinkInSidebar(articleid, '/', content, function(obj){cb(null, obj);});
          });
        },
        function(cb){
          var random_id = Math.floor(Math.random() * articleid + 1);
          var check_path  = '/article/' + random_id;
          engine.getArticle(check_path, targetHost, targetPort, true, function(err, content){
            if (err) { cb(null, {summary:'failed', reason:['GET request of ' + check_path + ' failed after comment posted']}); return; }
            checkLinkInSidebar(articleid, check_path, content, function(obj){cb(null, obj);});
          });
        }
      ], function(err, results){
        var summary = 'success';
        var reason = [];
        results.forEach(function(r){
          if (r.summary !== 'success') {
            summary = r.summary;
            reason = reason.concat(r.reason);
          }
        });
        if (summary === 'success')
          callback({summary:'success'});
        else
          callback({summary:summary, reason:reason});
      });
    }, 1000);
  });
};


function checker(articleid, data, callback){
  checkArticle(articleid, data, function(checkresult){
    if (checkresult.summary !== 'success') {
      callback(checkresult); return;
    }
    checkArticle(function(checkresult){
      if (checkresult.summary !== 'success') {
        callback(checkresult); return;
      }
      child.exec('perl -Mlib=' + __dirname + '/extlib/lib/perl5 ' + __dirname + '/static_check.pl ' + target, function(err, stdout, stderr){
        console.log(stdout);
        var checkresult = JSON.parse(stdout);
        callback(checkresult);
      });
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
    if (err){ callback({summary:'error', reason:['in checkArticle']}); return; }
    if (! isValidHtml(content)){
      callback({summary: 'error', reason:['in checkArticle, content is not valid html, size:' + content.length]});
      return;
    }
    engine.parseHtml(content, function($){
      //check of dom
      var checkresult = {};
      var failed_reasons = [];
      checkresult.articleid = articleid;
      checkresult.postlink = (/^(http:\/\/[-.a-zA-Z0-9]+(:\d+)?)?\/post$/.exec($('#view #titleimage a').attr('href')) ? true : false);
      checkresult.latestcomments = ($('#mainview #sidebar table tr td').eq(0).text() == '新着コメントエントリ');
      checkresult.title = ($('#articleview .article .title').text() == data.title);
      if (! checkresult.title)
        failed_reasons.push('title mismatch, original:' + data.title);
      checkresult.created = (/^\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d( \+0900)?$/.exec($('#articleview .article .created').text()) ? true : false);
      var gotbodylines = $('#articleview .article .body').html().split('\n').map(function(s){return s.trim();}).join('').split(/ *<br ?\/?>\n? */i);
      if (gotbodylines[gotbodylines.length - 1].length < 1)
        gotbodylines.pop();
      if (gotbodylines[0].substring(0,1) === '\n')
        gotbodylines[0] = gotbodylines[0].substring(1);
      var originallines = data.body.split('\n').map(function(s){return s.trim();});
      if (originallines[originallines.length - 1].length < 1)
        originallines.pop();
      checkresult.body = (gotbodylines.join('\n') == originallines.join('\n'));
      if (! checkresult.body)
        failed_reasons.push('article body mismatch, original:' + originallines.join('\n'));

      var summary = (checkresult.postlink && checkresult.latestcomments && checkresult.title && checkresult.created && checkresult.body);
      checkresult.summary = (summary ? 'success' : 'fail');
      if (failed_reasons.length > 0)
        checkresult.reason = failed_reasons;
      callback(checkresult);
    });
  });
};

function output(dirpath, load_result, checker_result, poster_result, callback){
  if (! load_result)
    load_result = {response:{success:0,error:1}, summary:'fail'};
  if (! load_result.response)
    load_result.response = {success:0,error:0};
      
  if (checker_result === null)
    checker_result = {summary:'init access (GET / or POST one article) failed'};
  if (poster_result === null)
    poster_result = {summary:'not run'};

  var totalresponse = Number(load_result.response.success) + Number(load_result.response.error);
  var load_test = (Number(load_result.response.error) < totalresponse * 0.01);
  var test = load_test && (checker_result.summary === 'success') && (poster_result.summary === 'success');
  var score = Number(load_result.response.success);

  var data = {
    teamid: teamid,
    resulttime: (new Date()),
    test:test,
    score:score,
    bench: load_result,
    checker: {checker:checker_result, poster:poster_result}
  };
  if (dirpath !== null)
    fs.writeFileSync(dirpath + '/result' + (new Date()).getTime(), JSON.stringify(data, null, '\t') + '\n', 'utf8');
  var req = http.request({
    host: conf.master.host.split(':')[0],
    port: conf.master.host.split(':')[1],
    method: 'POST',
    path: '/result/' + teamid,
    headers: {'Content-Type': 'application/json', 'User-Agent': 'ISUCon bench script v1.0'}
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
