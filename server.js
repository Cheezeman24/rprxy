var httpProxy = require('http-proxy');
var express = require('express');
var https = require('https');
var url = require('url');
var path = require('path');

var api = require('./api.js');
var blocked = require('./static/blocked.json');
var reBlocked = require('./static/re_blocked.json');

var port = process.env.PORT || 80;
var subdomainsAsPath = true;
var serveHomepage = true;
var serveHomepageOnAllSubdomains = true;

var proxy = httpProxy.createProxyServer({
  agent: new https.Agent({
    checkServerIdentity: function (host, cert) {
      return undefined;
    }
  }),
  changeOrigin: true
});

function stripSub (link) {
  var original = url.parse(link);
  var sub = '';
  var path = original.path;
  if (subdomainsAsPath) {
    var split = path.split('/');
    sub = split[1] && split[1] + '.';
    split.splice(1, 1);
    path = split.join('/');
  }
  return [path || '/', sub];
}

function getSubdomain (req, rewrite) {
  var sub;
  if (subdomainsAsPath) {
    var res = stripSub(req.url);
    if (rewrite) {
      req.url = res[0];
    }
    sub = res[1];
  } else {
    var domain = req.headers.host;
    sub = domain.slice(0, domain.lastIndexOf('.', domain.lastIndexOf('.') - 1) + 1);
  }
  return sub;
}

proxy.on('error', function (err, req, res) {
  console.error(err);

  res.writeHead(500, {
    'Content-Type': 'text/plain'
  });

  res.end('Proxying failed because' + err);
});

proxy.on('proxyReq', function (proxyReq, req, res, options) {
  proxyReq.setHeader('User-Agent', 'Mozilla');
  proxyReq.removeHeader('roblox-id');
});

var app = express();

app.use('/proxy', express.static('./static'));
app.use('/proxy', api);

app.use(function (req, res, next) {
  if (serveHomepage && stripSub(req.url)[0] === '/') {
    if (serveHomepageOnAllSubdomains || !getSubdomain(req)) {
      res.sendFile(path.join(__dirname, '/static/home.html'));
      return;
    }
  }
  next();
});

app.use(function (req, res, next) {
  for (var i = 0; i < blocked.length; i++) {
    if (req.url === blocked[i]) {
      res.end('URL blocked.');
      return;
    }
  }
  for (i = 0; i < reBlocked.length; i++) {
    if (req.url.match(reBlocked[i])) {
      res.end('URL blocked.');
      return;
    }
  }
  next();
});

app.use(function (req, res, next) {
  console.log('PROXY REQUEST; HOST: ' + req.headers.host + '; URL: ' + req.url + '; OPT: ' + req.body + '; COOKIE: ' + req.headers.cookie + ';');
  proxy.web(req, res, {
    target: 'https://' + (getSubdomain(req, true) || 'www.') + 'roblox.com'
  });
});

app.use(function (err, req, res, next) {
  console.error(err);

  res.writeHead(500, {
    'Content-Type': 'text/plain'
  });

  res.end('Proxy handler failed.');
});

app.listen(port, function () {
  console.log('Listening on port ' + port);
});
