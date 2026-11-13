'use strict';

var url = require('url');

module.exports = function (req, res) {
  var query = req.query || url.parse(req.url || '/', true).query;
  var folder = query.folder;
  var hash = query.hash;
  var filename = query.filename;

  if (typeof folder !== 'string' || typeof hash !== 'string' || typeof filename !== 'string') {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Ruta de imagen no válida');
  }

  req.url = '/img/' + folder + '/' + hash + '/' + filename;
  return require('../server').handleRequest(req, res);
};
