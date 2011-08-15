var testCase = require('nodeunit').testCase;
var http_load = require('http_load');

var TEST_RESULT_1 = (function(){
  return '583 fetches, 5 max parallel, 1.16836e+06 bytes, in 10 seconds\n' +
    '2004.04 mean bytes/connection\n' +
    '58.3 fetches/sec, 116836 bytes/sec\n' +
    'msecs/connect: 0.469086 mean, 13.23 max, 0.129 min\n' +
    'msecs/first-response: 84.874 mean, 166.376 max, 36.968 min\n' +
    '4 bad byte counts\n' +
    'HTTP response codes:\n' +
    '  code 200 -- 583\n';
})();
var TEST_RESULT_2 = (function(){
  return '300 fetches, 1 max parallel, 583200 bytes, in 30.0269 seconds\n' +
    '1944 mean bytes/connection\n' +
    '9.99106 fetches/sec, 19422.6 bytes/sec\n' +
    'msecs/connect: 0.605027 mean, 1.575 max, 0.264 min\n' +
    'msecs/first-response: 20.5997 mean, 52.42 max, 14.7 min\n' +
    'HTTP response codes:\n' +
    '  code 200 -- 250\n' +
    '  code 500 -- 50\n';
})();

module.exports = testCase({
  buildOptions: function(test){
    test.equals(http_load.buildOptions({parallel: 5, seconds: 60}), '-parallel 5 -seconds 60');
    test.throws(function(){http_load.buildOptions({parallel: 5, seconds: 60, hoge:true});});
    test.done();
  },
  resultParser: function(test){
    test.deepEqual(http_load.resultParser(TEST_RESULT_1), {
      fetches: 583, 'max parallel': 5, bytes: 1.16836e+06, seconds: 10,
      'mean bytes/connection': 2004.04,
      'fetches/sec': 58.3, 'bytes/sec': 116836,
      'msecs/connect': {mean: 0.469086, max: 13.23, min: 0.129},
      'msecs/first-response': {mean: 84.874, max: 166.376, min: 36.968},
      response: {success: 583, error: 0},
      responseCode: {'200': 583}
    });
    test.deepEqual(http_load.resultParser(TEST_RESULT_2), {
      fetches: 300, 'max parallel': 1, bytes: 583200, seconds: 30.0269,
      'mean bytes/connection': 1944,
      'fetches/sec': 9.99106, 'bytes/sec': 19422.6,
      'msecs/connect': {mean: 0.605027, max: 1.575, min: 0.264},
      'msecs/first-response': {mean: 20.5997, max: 52.42, min: 14.7},
      response: {success: 250, error: 50},
      responseCode: {'200': 250, '500': 50}
    });
    test.done();
  }
});
