'use strict';

module.exports = function (req, res) {
  return require('../server').handleRequest(req, res);
};
