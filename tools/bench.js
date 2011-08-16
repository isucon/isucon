var fs = require('fs');

var http_load = require('http_load');
var engine = require('bench_engine.js');

var HTTP_LOAD_PARALLEL = 5;
var HTTP_LOAD_SECONDS = 180;
var COMMENT_POST_INTERVALS = 50; //milliseconds
var CHEKCER_START_DURATION = 30000; //milliseconds

var config = JSON.parse(fs.readFileSync(__dirname + '/../webapp/config/hosts.json', 'utf-8'));
var targetHost = config.servers.reverseproxy[0];

var continuousMode = false;
if (process.argv.length > 2 && process.argv[2] === 'inf') {
  continuousMode = true;
  console.log('continuous mode on');
}

function prepare(callback){
  engine.getArticle('/', targetHost, function(err, content){
    if (err){
      process.exit(1);
    }
    engine.parseHtml(content, function($){
      var latestArticleURI = $('#articleview :eq(0) .articlelink a').attr('href');
      var startId = 1;
      if (latestArticleURI) {
        var matched = /\/article\/(\d+)$/.exec(latestArticleURI);
        startId = Number(matched[1]) + 1;
      }
      engine.postArticles({hostname:targetHost, articles:5, articlesize:1000, startid:startId}, function(err, uriContentPairs){
        if (err){
          process.exit(1);
        }
        engine.generateUrlsFile(targetHost, uriContentPairs, function(dirpath, filepath){
          callback(dirpath, filepath, uriContentPairs);
        });
      });
    });
  });
};

var loading = true;
process.on('SIGUSR1', function(){
  loading = false;
});

function load(dirpath, urlsFilePath, uriContentPairs){
  var checker_result = null;
  http_load.start(urlsFilePath, {parallel: HTTP_LOAD_PARALLEL, seconds: HTTP_LOAD_SECONDS}, function(err, result){
    output(dirpath, result, checker_result);
    if (loading && continuousMode)
      process.nextTick(function(){
        load(dirpath, urlsFilePath, uriContentPairs);
      });
    else
      process.exit(0);
  });
  setTimeout(function(){checker(uriContentPairs, function(r){checker_result = r;});}, CHEKCER_START_DURATION);
  // setInterval(function(){commentposter(uriContentPairs);}, COMMENT_POST_INTERVALS);
};

function commentposter(){
  
};

var checker_retry = false;
function checker(uriContentPairs, callback){
  engine.getArticle(uriContentPairs[Math.floor(Math.random() * uriContentPairs.length)][0], targetHost, function(err, content){
    if (err) {
      if (!checker_retry) {
        checker_retry = true;
        process.nextTick(function(){checker(uriContentPairs, callback);});
      }
      else {
        callback({check:'error'});
      }
      return;
    }
    engine.parseHtml(content, function($){
      //check of dom


      if (false)
        callback({check:'fail'});
      else
        callback({check:'success'});
    });
  });
};

function output(dirpath, result, checker_result){
  fs.writeFileSync(dirpath + '/result' + (new Date()).getTime(), JSON.stringify({bench: result, checker: checker_result}), 'utf8');
};

prepare(function(dirpath, filepath, uriContentPairs){
  load(dirpath, filepath, uriContentPairs);
});
