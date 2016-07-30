var jsdom = require('jsdom');

var parseHtml = exports.parseHtml = function(content, callback){
  jsdom.env({
    html: content,
    scripts: [
      'http://code.jquery.com/jquery.js'
    ],
    done: function (err, window) {
      var $ = window.jQuery;
      callback(window.$);
    }
  });
};


var http = require('http');

var getArticle = exports.getArticle = function(path, hostname, portnum, retry, callback){
  if (!callback && retry) {
    callback = retry;
    retry = undefined;
  }
  http.get({
    host: hostname, port: portnum, path: path, headers: {'User-Agent': 'http_load 12mar2006'}
  }, function(res){
    if (res.statusCode !== 200) {
      if (retry) {
        process.nextTick(function(){
          getArticle(path, hostname, portnum, false, callback);
        });
      }
      else {
        console.log({error: 'error for GET ' + path, response: res});
        callback({error: 'error for GET ' + path, response: res});
      }
      return;
    }
    res.setEncoding('utf8');
    var content = '';
    res.on('data', function(chunk){
      content += chunk;
    }).on('end', function(){
      callback(null, content);
    });
  }).on('error', function(e){
    if (retry) {
      process.nextTick(function(){
        getArticle(path, hostname, portnum, false, callback);
      });
      return;
    }
    console.log({error: e});
    callback({error: e});
  });
};

var chars = 'abcdefghijklmnopqrstuvwxyz0123456789\n';
chars += 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん\n';
chars += 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン\n';
chars += 'ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ\n';
chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ\n';
var charLength = chars.length;

function randomString(size){
  var str = '';
  for (var i = 0; i < size; i++){
    str += chars[Math.floor(Math.random() * charLength)];
  }
  return str;
};

function uriEncodeForFormData(str){
  // see: https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/encodeURIComponent
  return encodeURIComponent(str).replace(/%20/g, '+');
};

function generateFormBody(obj){
  var pairs = [];
  for (var key in obj){
    pairs.push(uriEncodeForFormData(key) + '=' + uriEncodeForFormData(obj[key]));
  }
  return pairs.join('&');
};

function articleIdToPath(articleid){
  return '/article/' + articleid;
};
function articleIdToCommentPath(articleid){
  return '/comment/' + articleid;
};

var postArticle = exports.postArticle = function(options, callback){
  var articlesize = options.articlesize || 1000;
  var articleid = options.articleid || 1;
  var hostname = options.hostname;
  var portnum = options.portnum;

  var formdata = {title:randomString(20).split('\n').join(''), body:randomString(articlesize)};
  var postdata = generateFormBody(formdata);
  var dataLength = (new Buffer(postdata, 'utf8')).length;
  var req = http.request({
    host: hostname, port: portnum, method:'POST', path:'/post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': dataLength,
      'User-Agent': 'http_load 12mar2006'
    }
  }, function(res){
    if (res.statusCode == 200 || (res.statusCode >= 300 && res.statusCode <= 399))
      callback(null, articleid, formdata);
    else {
      callback({message:'post response has error status', code: res.statusCode, res: res});
    }
  });
  req.on('error',function(err){
    callback({message:'error in http.request', error:err});
  });
  req.end(postdata);
};

var postComment = exports.postComment = function(options, callback){
  var articleid = options.articleid;
  var commentsize = options.size || 150;
  var hostname = options.hostname;
  var portnum = options.portnum;

  var commentname = (Math.random() * 2 > 1) ? randomString(5) : '';
  var commentbody = randomString(commentsize);
  var postdata = generateFormBody({name: commentname, body: commentbody});
  var dataLength = (new Buffer(postdata, 'utf8')).length;
  var req = http.request({
    host: hostname, port: portnum, method: 'POST', path: '/comment/' + articleid,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': dataLength,
      'User-Agent': 'http_load 12mar2006'
    }
  }, function(res){
    if (res.statusCode == 200 || (res.statusCode >= 300 && res.statusCode <= 399))
      callback(null, commentname, commentbody);
    else {
      callback({message:'post response has error status', code: res.statusCode, res: res});
    }
  });
  req.on('error', function(err){ callback({message:'error in http.request for comment', error: err}); });
  req.end(postdata);
};

var indexList = [
  '/',
  '/css/jquery-ui-1.8.14.custom.css',
  '/css/isucon.css',
  '/js/jquery-1.6.2.min.js',
  '/js/jquery-ui-1.8.14.custom.min.js',
  '/js/isucon.js',
  '/images/isucon_title.jpg'
];

var fs = require('fs');

var generateUrlsFile = exports.generateUrlsFile = function(hostname, portnum, mainTargetId, callback){
  var genUrl = function(path){return 'http://' + hostname + (portnum === 80 ? '' : ':' + portnum) + path;};

  var dirpath = __dirname + '/../data/isucon_' + (new Date()).getTime();
  fs.mkdirSync(dirpath, 0755);
  var filepath = dirpath + '/urls';

  var paths = [];
  var indexAndMisc = indexList.map(genUrl).join('\n') + '\n';

  for(var i = 0; i < 20; i++)
    paths.push(indexAndMisc);
  for(var j = 0; j < 30; j++)
    paths.push(genUrl('/article/' + mainTargetId) + '\n');
  for(var k = 0; k < 50; k++)
    paths.push(genUrl('/article/' + Math.floor(Math.random() * mainTargetId + 1)) + '\n');

  var urlsFileBody = paths.join('');
  fs.writeFileSync(filepath, urlsFileBody, 'utf8');

  callback(dirpath);
};
