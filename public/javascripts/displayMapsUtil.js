/**
 * /master/?type=0&kml=weather.kml&pass=abc123
 * /slave/?type=0&xy=0,0&pass=abc123
 *
 * type 0または1を指定する（省略した場合は0）
 * kml KMLファイルを指定する（オプション）
 * pass MASTERとSLAVEの組み合わせを識別する任意の英数字（省略した場合はdefault）
 */
//var APP_MODE = 0;
 
var MASTER_MODE = 0;
var SLAVE_MODE = 1;
var MAP_TYPE = 0;
var EARTH_TYPE = 1;

var socket;
var map;
var earth;
var kml = '';
// Google Earthの初期化
if(isType(EARTH_TYPE)) {
	google.load('earth', '1');
	google.setOnLoadCallback(function() {
		google.earth.createInstance('Map',
		function(instance) {
			earth = instance;
			earth.getWindow().setVisibility(true);
			if(isMasterMode()) earth.getNavigationControl().setVisibility(earth.VISIBILITY_SHOW);
			
			kml = getAppParams('kml' , '');
			if(kml == '') return;
			var tour = null;
			var features = earth.getFeatures();
			while (features.getFirstChild())
				features.removeChild(features.getFirstChild());
				var link = earth.createLink('');
				link.setHref(kml);
				var networkLink = earth.createNetworkLink('');
				networkLink.set(link, true, true); // Sets the link, refreshVisibility, and flyToView
				earth.getFeatures().appendChild(networkLink);
				google.earth.fetchKml(earth, kml, function(object){
					walkKmlDom(object, function() {
					if (this.getType() == 'KmlTour') {
						tour = this;
						return false;
					}
				});
				earth.getTourPlayer().setTour(tour);
				earth.getTourPlayer().play();
			});
		},
		function(error) {
		}
	)});
}

$(function() {
	socket = io.connect();	
	// Google Mapsの初期化
	if(isType(MAP_TYPE)) {
		var options = {
			scaleControl: true,
			overviewMapControl: true,
			overviewmapcontrolOptions: {
				opend: true
			},
			zoom: 3,
			center: new google.maps.LatLng(0, 0),
			mapTypeId: google.maps.MapTypeId.ROADMAP
		};
		map = new google.maps.Map(document.getElementById("Map"), options);
	}
	if(isModeAndType(MASTER_MODE, MAP_TYPE)) {
		initWithMasterModeAndMapType();
	}
	if(isModeAndType(MASTER_MODE, EARTH_TYPE)) {
		initWithMasterModeAndEarthType();
	}
	if(isModeAndType(SLAVE_MODE, MAP_TYPE)) {
		initWithSlaveModeAndMapType();
	}
	if(isModeAndType(SLAVE_MODE, EARTH_TYPE)) {
		initWithSlaveModeAndEarthType();
	}
	// ウィンドウサイズの調整
	refreshWindowSize();
	$(window).bind('resize', refreshWindowSize);
	// MASTER 検索
	$("#UISearchInput").live('keyup', function(e) {
	    if((e.which && e.which === 13) || (e.keyCode && e.keyCode === 13)) {
	        var address = $("#UISearchInput").val();
	        var geocoder = new google.maps.Geocoder();
			geocoder.geocode( { 'address': address}, function(results, status) {
				if (status == google.maps.GeocoderStatus.OK) {
					var position =results[0].geometry.location;
					console.log(results);
					if(isType(MAP_TYPE)) {
						map.setCenter(position);
					}else {
						var camera = earth.getView().copyAsCamera(earth.ALTITUDE_ABSOLUTE);
						camera.setLatitude(position.lat());
						camera.setLongitude(position.lng());
						earth.getView().setAbstractView(camera);
					}
				} else {
				}
			});
	    }
	});
	// MASTER 位置情報を要求
	$("#UILocationButton").live('click', function(e) {
		if(navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(function(e) {
				var lat = e.coords.latitude;
				var lng = e.coords.longitude;
				if(isType(MAP_TYPE)) {
					map.setCenter(new google.maps.LatLng(lat, lng));
				}else {
					var camera = earth.getView().copyAsCamera(earth.ALTITUDE_ABSOLUTE);
					camera.setLatitude(lat);
					camera.setLongitude(lng);
					earth.getView().setAbstractView(camera);
				}
			}, function() {
			});
		}
	});
	$(".UIMapTypeButton").live('click', function(e) {
		var type = $(this).attr('value');
		window.location.href = "/maps/master/?type=" + type + "&kml=" + getAppParams('kml', '') + "&pass=" + getAppParams('pass', 'default') + "&state=" + getRandomCode();
	});
	// MASTER 新しいPASSコードが入力されたらページを更新する
	$("#UIPassInput").live('keyup', function(e) {
	    if((e.which && e.which === 13) || (e.keyCode && e.keyCode === 13)) {
	    	masterRedirect();
	    }
	});
	// MASTER PASSを取得する
	$("#UIPassInput").val(getAppParams('pass', 'default'));
	// MASTER KMLを取得する
	$("#UIKmlInput").val(getAppParams('kml', ''));
	// MASTER 新しいKMLファイルが入力されたらページを更新する
	$("#UIKmlInput").live('keyup', function(e) {
	    if((e.which && e.which === 13) || (e.keyCode && e.keyCode === 13)) {
	    	masterRedirect();
	    }
	});
});
// MASTER ページを更新する
function masterRedirect() {
	var pass = $("#UIPassInput").val();
	var kml = $("#UIKmlInput").val();
	if(pass == "") return;
	window.location.href = "/maps/master/?type=" + getAppParams('type', MAP_TYPE) + "&kml=" + kml + "&pass=" + pass + "&state=" + getRandomCode();
}

// SLAVE ページを更新する
function slaveRedirect(type) {
	var pass = getAppParams('pass', 'default');
	var position = getAppParams("xy", "0,0");
	window.location.href = "/maps/slave/?type=" + type + "&pass=" + pass + "&xy=" + position + "&state=" + getRandomCode();
}

/**
 * MASTER_MODE かつ MAP_TYPEのとき
 */
function initWithMasterModeAndMapType() {
	var kml = getAppParams('kml', '');
	if(kml != '') {
		new google.maps.KmlLayer(kml).setMap(map);
	}
	google.maps.event.addListener(map, 'tilesloaded', emitWithMapType);
	google.maps.event.addListener(map, 'bounds_changed', emitWithMapType);
}

/**
 * MASTER_MODE かつ EARTH_TYPEのとき
 */
function initWithMasterModeAndEarthType() {
	setInterval(emitWithMapType, 2000);
}
/**
 * SLAVE_MODE かつ MAP_TYPEのとき
 */
function initWithSlaveModeAndMapType() {
	var kml = "";
	socket.on('maps', function(data) {
		data = eval("(" + data + ")"); // JSON形式を整形する
		var position = getAppParams("xy", "0,0").split(","); // 表示領域を取得する
		var pass = getAppParams("pass", "default");
		if(data.pass != pass) return;　// 識別子が一致しない場合、破棄する
		if(data.type != MAP_TYPE) return slaveRedirect(data.type); // TYPEを変更する
		
		var latLng = new google.maps.LatLng(data.latitude, data.longitude);
		map.setCenter(latLng);
		map.setZoom(parseFloat(data.zoom));
		map.setMapTypeId(data.mapTypeId);
		bounds = map.getBounds();
		var lat = bounds.getNorthEast().lat();
		var lng = bounds.getNorthEast().lng();
		var x = google.maps.geometry.spherical.computeDistanceBetween(latLng, new google.maps.LatLng(data.latitude, lng))*2;
		var y = google.maps.geometry.spherical.computeDistanceBetween(latLng, new google.maps.LatLng(lat, data.longitude))*2;
		
		var heding;
		var newLatLng;
		if(position[0] > 0) {heding = 90;} else {heding = -90;}
		newLatLng = google.maps.geometry.spherical.computeOffset(latLng, Math.abs(x*position[0]), heding, 0);
		if(position[1] > 0) {heding = 0;} else {heding = 180;}
		newLatLng = google.maps.geometry.spherical.computeOffset(newLatLng, Math.abs(y*position[1]), heding, 0);
		map.setCenter(newLatLng);
		
		if(kml == data.kml) return;
		var kmlLayer = new google.maps.KmlLayer(data.kml);
		kmlLayer.setMap(map);
		kml = data.kml;
	});
}

/**
 * SLAVE_MODE かつ EARTH_TYPEのとき
 */
function initWithSlaveModeAndEarthType() {
	socket.on('maps', function(data){
		data = eval("(" + data + ")"); // JSON形式を整形する
		var position = getAppParams("xy", "0,0").split(","); // 表示領域を取得する
		var pass = getAppParams("pass", "default");
		if(data.pass != pass) return;　// 識別子が一致しない場合、破棄する
		if(data.type != EARTH_TYPE) return slaveRedirect(data.type); // TYPEを変更する

		var lla = new Array();
		var htr = new Array();
		lla[0] = (data.latitude != "") ? parseFloat(data.latitude) : 0;
		lla[1] = (data.longitude != "") ? parseFloat(data.longitude) : 0;
		lla[2] = (data.altitude != "") ? parseFloat(data.altitude) : 0;
		htr[0] = (data.heading != "") ? parseFloat(data.heading) : 0;
		htr[1] = (data.tilt != "") ? parseFloat(data.tilt) : 0;
		htr[2] = (data.roll != "") ? parseFloat(data.roll) : 0;
		var degressToRad = Math.PI / 180;
		var transform = setFromEuler([(90-htr[1])*degressToRad, htr[2] * degressToRad, htr[0] * degressToRad]);
		transform = rotationZ(transform, position[0] * 60 * degressToRad);
		var _htr = getOrientation(transform);
		var camera = earth.getView().copyAsCamera(earth.ALTITUDE_ABSOLUTE);
		camera.setLatitude(parseFloat(lla[0]));
		camera.setLongitude(parseFloat(lla[1]));
		camera.setAltitude(parseFloat(lla[2]));
		camera.setHeading(parseFloat(_htr[0]));
		camera.setTilt(parseFloat(fixAngle360(90 - _htr[1])));
		camera.setRoll(parseFloat(_htr[2]));	
		earth.getView().setAbstractView(camera);
		
		if(kml == data.kml) return;
		
		kml = data.kml;
		var tour = null;
		var features = earth.getFeatures();
		while (features.getFirstChild())
			features.removeChild(features.getFirstChild());
			var link = earth.createLink('');
			link.setHref(data.kml);
			var networkLink = earth.createNetworkLink('');
			networkLink.set(link, true, true); // Sets the link, refreshVisibility, and flyToView
			earth.getFeatures().appendChild(networkLink);
			google.earth.fetchKml(earth, data.kml, function(object){
				walkKmlDom(object, function() {
				if (this.getType() == 'KmlTour') {
					tour = this;
					return false;
				}
			});
			//earth.getTourPlayer().setTour(tour);
			//earth.getTourPlayer().play();
		});
	});
}

/**
 * MASTER_MODE 送信メッセージ
 */
function emitWithMapType() {
	var dic = new Array();
	if(isType(MAP_TYPE)) {
		dic['latitude'] = map.getCenter().lat();
		dic['longitude'] = map.getCenter().lng();
		dic['zoom'] = map.getZoom();
		dic['mapTypeId'] = map.getMapTypeId();
	}
	if(isType(EARTH_TYPE)) {
		var camera = earth.getView().copyAsCamera(earth.ALTITUDE_RELATIVE_TO_GROUND);
		dic['latitude'] = camera.getLatitude();
		dic['longitude'] = camera.getLongitude();
		dic['altitude'] = camera.getAltitude();
		dic['heading'] = camera.getHeading();
		dic['tilt'] = camera.getTilt();
		dic['roll'] = camera.getRoll();
	}
	dic['type'] = getAppParams('type', MAP_TYPE);
	dic['kml'] = getAppParams('kml', "");
	dic['pass'] = getAppParams('pass', "default");
	console.log(makeJson(dic));
	var json = makeJson(dic);
	socket.emit('maps', json);
	if (window.localStorage){
		window.localStorage["json"] = json;
	}
	$("#UIJsonText").text(json);
}

/**
 * 指定したMODEとTYPEが実行中のMODEとTYPEと一致したときにtrueを返す
 */
function isModeAndType(mode, type) {
	return (APP_MODE == mode && type == getAppParams('type', MAP_TYPE));
}
/**
 * MASTER_MODEで実行のときにtrueを返す
 */
function isMasterMode() {
	return (APP_MODE == MASTER_MODE);
}
/**
 * 指定したTYPEが実行中のTYPEと一致したときにtrueを返す
 */
function isType(type) {
	return (type == getAppParams('type', MAP_TYPE));
}

/**
 * 指定したGETパラメータを取得する
 */
function getAppParams(key, defVal) {
	var query = window.location.search.substring(1);
	params = query.split('&');
	for(var i = 0; i < params.length; i++) {
		var position = params[i].indexOf('=');
		if(position > 0 && key == params[i].substring(0, position)) {
			return params[i].substring(position+1);
		}
	}
	return defVal;
}

/**
 * ウィンドウのサイズを変更する
 */
function refreshWindowSize() {
	var agent = navigator.userAgent;
	if((agent.search(/iPhone/) != -1) || (agent.search(/iPod/) != -1)) { // 制限付きUIを提供する
		$('#Menu').css('width', 0);
	}
	var offset = (isMasterMode()) ? $('#Menu').width() : 0; 
	$('#Map').css('height', $(window).height());
	$('#Map').css('width', $(window).width() - offset);
}
/**
 * 連想配列をJSON形式に変換する
 */
function makeJson(dic) {
	var flag = true;
	var str = "{";
	for(var i in dic) {
		if(!flag) str += ',';
		str += '"' + i.replace('"', '\\"', 'g') + '":';
		if(isNaN(dic[i])) { // 文字列の場合
	 		str += '"' + dic[i].replace('"', '\\"', 'g') + '"';			
		}else if(dic[i] == "") { // 空のとき
			str += '""';
		}else { // 数字のとき
			str += dic[i];
		}
		flag = false;
	}
	str += '}';
	return str;
}

function getRandomCode() {
	return Math.floor( Math.random() * 10000);
}

/**********************************
以下、Google Earth表示領域を計算する関数
**********************************/
function setFromEuler(xyz) {
	var cx = Math.cos(xyz[0]);
	var sx = Math.sin(xyz[0]);
	var cy = Math.cos(xyz[1]);
	var sy = Math.sin(xyz[1]);
	var cz = Math.cos(xyz[2]);
	var sz = Math.sin(xyz[2]);
	return [[cz * cy + sz * sx * sy, -sz * cy + cz * sx * sy, cx * sy], [sz * cx, cz * cx, -sx], [cz * -sy + sz * sx * cy, -sz * -sy + cz * sx * cy, cx * cy]];
}

function rotationZ(mat, angle) {
	var c = Math.cos(angle);
	var s = Math.sin(angle);
	return multiply(mat, [
		[c, -s, 0],
		[s, c, 0],
		[0, 0, 1]
	]);
}

function multiply(a, b) {
	var result = [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0]
	];
	for(var i = 0; i < 3; i++) {
		for(var j = 0; j < 3; j++) {
			result[i][j] = a[0][j] * b[i][0] + a[1][j] * b[i][1] + a[2][j] * b[i][2];
		}
	}
	return result;
}

function getOrientation(mat) {
	var radToDegrees = 180 / Math.PI;
	var yaw;
	var tilt;
	var roll;
	if (mat[1][2] > 0.998) {
		yaw = Math.atan2(-mat[2][0], -mat[2][1]);
		tilt = -Math.PI/2;
		roll = 0
	} else {
		if (mat[1][2] < -0.998) {
			yaw = Math.atan2(mat[2][0], mat[2][1]);
			tilt = Math.PI;
			roll = 0;
		} else {
			var yaw = Math.atan2(mat[1][0], mat[1][1]);
			var tilt = Math.asin(-mat[1][2]);
			var roll = Math.atan2(mat[0][2], mat[2][2]);
		}
	}
	return [yaw * radToDegrees, tilt * radToDegrees, roll * radToDegrees];
}
function fixAngle360(a) {
	while (a <= -360) {
		a += 360
	}
	while (a >= 360) {
		a -= 360
	}
	return a
}
