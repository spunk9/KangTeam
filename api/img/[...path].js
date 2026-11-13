'use strict';

module.exports = function (req, res) {
  // Vercel may expose the rewrite destination path to the function. The
  // shared handler expects the public /img/... path used by the storefront.
  if (req.url && req.url.indexOf('/api/img/') === 0) {
    req.url = req.url.replace(/^\/api\/img\//, '/img/');
  }
  return require('../../server').handleRequest(req, res);
};
