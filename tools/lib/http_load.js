var exec = require('child_process').exec;

var HTTP_LOAD_PATH = __dirname + '/../http_load-12mar2006/http_load';

var start = exports.start = function(urlsFilePath, options, callback){
  var command = HTTP_LOAD_PATH + ' ' + buildOptions(options) + ' ' + urlsFilePath;
  var child = exec(command, function(error, stdout, stderr){
    if (error) {
      callback(error, stdout);
      return;
    }
    callback(null, resultParser(stdout));
  });
};

/* synopthis
usage:  ./http_load [-checksum] [-throttle] [-proxy host:port] [-verbose] [-timeout secs] [-sip sip_file]
            -parallel N | -rate N [-jitter]
            -fetches N | -seconds N
            url_file
One start specifier, either -parallel or -rate, is required.
One end specifier, either -fetches or -seconds, is required.
 */
var buildOptions = exports.buildOptions = function(options){
  var opts = [];
  var http_load_options = ['parallel', 'rate', 'jitter', 'fetches', 'seconds', 'checksum',
                           'throttle', 'proxy', 'verbose', 'timeout', 'sip'];
  var withOutArguments = ['jitter', 'checksum', 'throttle', 'verbose'];
  for (var key in options) {
    if (http_load_options.indexOf(key) < 0)
      throw "unknown option";

    if (withOutArguments.indexOf(key) > -1 && options[key])
      opts.push('-' + key);
    else
      opts.push('-' + key + ' ' + options[key]);
  }
  return opts.join(' ');
};

/* result (stdout)
583 fetches, 5 max parallel, 1.16836e+06 bytes, in 10 seconds
2004.04 mean bytes/connection
58.3 fetches/sec, 116836 bytes/sec
msecs/connect: 0.469086 mean, 13.23 max, 0.129 min
msecs/first-response: 84.874 mean, 166.376 max, 36.968 min
4 bad byte counts
HTTP response codes:
  code 200 -- 583
 */
/*
300 fetches, 1 max parallel, 583200 bytes, in 30.0269 seconds
1944 mean bytes/connection
9.99106 fetches/sec, 19422.6 bytes/sec
msecs/connect: 0.605027 mean, 1.575 max, 0.264 min
msecs/first-response: 20.5997 mean, 52.42 max, 14.7 min
HTTP response codes:
  code 200 -- 300
 */

var resultParser = exports.resultParser = function(data){
  var result = {};
  var lines = data.split('\n');
  while (lines.length > 0) {
    var line = lines.shift();
    var matched = null;
    if ((matched = /(\d+) fetches, (\d+) max parallel, ([\.0-9e\+]+) bytes, in ([\.0-9]+) seconds/.exec(line)) !== null) {
      result['fetches'] = Number(matched[1]);
      result['max parallel'] = Number(matched[2]);
      result['bytes'] = Number(matched[3]);
      result['seconds'] = Number(matched[4]);
      continue;
    }
    if ((matched = /([\.0-9]+) mean bytes\/connection/.exec(line)) !== null) {
      result['mean bytes/connection'] = Number(matched[1]);
      continue;
    }
    if ((matched = /([\.0-9]+) fetches\/sec, ([\.0-9]+) bytes\/sec/.exec(line)) !== null) {
      result['fetches/sec'] = Number(matched[1]);
      result['bytes/sec'] = Number(matched[2]);
      continue;
    }
    if ((matched = /msecs\/connect: ([\.0-9]+) mean, ([\.0-9]+) max, ([\.0-9]+) min/.exec(line)) !== null) {
      result['msecs/connect'] = {mean: Number(matched[1]), max: Number(matched[2]), min: Number(matched[3])};
      continue;
    }
    if ((matched = /msecs\/first-response: ([\.0-9]+) mean, ([\.0-9]+) max, ([\.0-9]+) min/.exec(line)) !== null) {
      result['msecs/first-response'] = {mean: Number(matched[1]), max: Number(matched[2]), min: Number(matched[3])};
      continue;
    }
    if ((matched = /HTTP response codes:/.exec(line)) !== null) {
      result['response'] = {success: 0, error: 0};
      result['responseCode'] = {};
      continue;
    }
    if ((matched = /code (\d+) -- (\d+)/.exec(line)) !== null) {
      result['responseCode'][String(matched[1])] = Number(matched[2]);
      if (matched[1] == 200 || (matched[1] >= 300 && matched[1] <= 399)) {
        result['response']['success'] += Number(matched[2]);
      } else {
        result['response']['error'] += Number(matched[2]);
      }
      continue;
    }
  }
  return result;
};