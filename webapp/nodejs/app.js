var express = require('express'),
    jade = require('jade'),
    mysql = require('mysql'),
    app = express.createServer();

function error_handle(req, res, err){
  console.log(err);
  console.log(err.stack);
  res.send(err, 500);
};

app.configure(function(){
  /* default ':remote-addr - - [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"' */
  app.use(express.logger('default'));
  app.use(express.methodOverride());
  app.use(express.bodyParser());

  app.use(express.static(__dirname + '/public'));
  app.use(express.errorHandler());

  app.use(app.router);
});

app.get('/', function(req, res){
  res.render(__dirname + '/views/index.jade', {layout: false, sqlresult: ''});
});

app.listen(5000);
