'use strict';

module.exports = function (req, res) {
  var query = req.query || {};
  var match = (req.url || '').match(/\/api\/album\/(\d+)/);
  var id = String(query.id || (match && match[1]) || '');

  if (!/^\d+$/.test(id)) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'ID no válido' }));
  }

  req.url = '/api/album/' + id;
  return require('../../server').handleRequest(req, res);
};
