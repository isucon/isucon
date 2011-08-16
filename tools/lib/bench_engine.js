var jsdom = require('jsdom');

var parseHtml = exports.parseHtml = function(content, callback){
  jsdom.env({
    html: content,
    scripts: [
      'http://code.jquery.com/jquery.js'
    ]
  }, function (err, window) {
    var $ = window.jQuery;
    callback(window.$);
  });
};


var http = require('http'),
    async = require('async');

var getArticle = exports.getArticle = function(path, hostname, callback){
  http.get({host: hostname, port: /* 80 */ 5000, path: path}, function(res){
    if (res.statusCode !== 200) {
      console.log({error: 'error for GET ' + path + ' in prepare phase.', response: res});
      callback({error: 'error for GET ' + path + ' in prepare phase.', response: res});
    }
    res.setEncoding('utf8');
    var content = '';
    res.on('data', function(chunk){
      content += chunk;
    }).on('end', function(){
      callback(null, content);
    });
  }).on('error', function(e){
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

var postArticles = exports.postArticles = function(options, callback){
  var articles = options.articles || 5;
  var articlesize = options.articlesize || 1000;
  var startid = options.startid || 1;
  var hostname = options.hostname;

  var uriContentPairs = [];
  var closures = [];

  for (var i = 0; i < articles; i++){
    var articleid = startid + i;
    var formdata = {title:randomString(20).split('\n').join(''), body:randomString(articlesize)};
    uriContentPairs.push(['/article/' + articleid, formdata]);

    closures.push(function(cb){
      var data = (uriContentPairs.shift())[1];
      var req = http.request({
        host: hostname, port: /* 80 */ 5000,
        method:'POST', path:'/post', headers: {'Content-Type': 'application/x-www-form-urlencoded'}
      }, function(res){
        if (res.statusCode == 200 || (res.statusCode >= 300 && res.statusCode <= 399))
          cb(null, 'ok');
        else {
          cb({message:'post response has error status', code: res.statusCode, res: res});
        }
      });
      req.on('error',function(err){
        cb({message:'error in http.request', error:err});
      });
      req.write(generateFormBody(data));
      req.end();
    });
  }
  var uriContentPairsCopy = uriContentPairs.concat();
  async.series(closures, function(err, results){
    if (err) { callback(err); return; }
    callback(null, uriContentPairsCopy);
  });
};

var etcContentList = [
  '/css/jquery-ui-1.8.14.custom.css',
  '/css/isucon.css',
  '/js/jquery-1.6.2.min.js',
  '/js/jquery-ui-1.8.14.custom.min.js',
  '/js/isucon.js',
  '/images/isucon_title.jpg',
  '/'
];

var fs = require('fs');
var config = JSON.parse(fs.readFileSync(__dirname + '/../../webapp/config/hosts.json', 'utf-8'));

var generateUrlsFile = exports.generateUrlsFile = function(hostname, uriContentPairs, callback){
  var dirpath = __dirname + '/../data/isucon_' + (new Date()).getTime();
  fs.mkdirSync(dirpath, 0755);
  var filepath = dirpath + '/urls';
  var paths = etcContentList.concat(uriContentPairs.map(function(pair){return pair[0];}));
  var urlsFileBody = paths.map(function(p){return 'http://' + hostname + ':5000' + p;}).join('\n');
  fs.writeFileSync(filepath, urlsFileBody, 'utf8');
  callback(dirpath, filepath);
};
