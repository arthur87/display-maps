
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index');
};

exports.maps_master = function(req, res){
  res.render('maps_master');
};

exports.maps_slave = function(req, res){
  res.render('maps_slave');
};