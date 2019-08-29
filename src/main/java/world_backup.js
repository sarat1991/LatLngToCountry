// Country Code Grid
// Query country code information from geographical coordinates
//

// Boilerplate from https://github.com/umdjs/umd/blob/master/returnExports.js

// ----------------

// Configuration. Should match generator settings
var gridPath = './/src//main//resources//node_module//tiles//',
    worldFile = 'worldgrid.json',
    cellzoom = 5,
    zList = [9, 13];
//var fs = require('fs');
var console = {log: print, warn: print, error: print}
//module.exports = factory(null,require('fs'));
// Cache of json file across zoom levels
var jsonCache = {};

// Global attribute list for compressed grids
var worldAttr;

// Internal classes
var Grid, Zoomgrids;

// Return module

// Class for a single utf-grid
Grid = function (tx, ty, zoom, json) {
  var grid = {},
      size = 0,
      data, keys, attrs, elezoom, elex, eley;

  // set public members
  grid.x = tx;
  grid.y = ty;
  grid.zoom = zoom;

  // initialise
  if (!(json.hasOwnProperty('grid') && json.hasOwnProperty('keys'))) {
    console.warn('Error in creating grid - no grid/keys attribute');
    return null;
  }
  data = json.grid;
  keys = json.keys;
  if (json.hasOwnProperty('data')) {
    attrs = json.data;
  }
  size = json.grid.length;
  elezoom = Math.round(Math.log(size) / Math.log(2)) + zoom;
  elex = tx * Math.pow(2, (elezoom - zoom));
  eley = ty * Math.pow(2, (elezoom - zoom));

  function utfDecode(c) {
    if (c >= 93) {
      c--;
    }
    if (c >= 35) {
      c--;
    }
    return c - 32;
  }

  function isInt(n) {
    return n % 1 === 0;
  }

  function getAttr(x, y) {
    // resolve redirects and decompress
    var dataY = data[y];
    var dataYLen = dataY.length;
    if ((dataYLen > 1) && (dataYLen < 4)) {
      var redir = parseInt(dataY);
      if (redir.isNaN || redir < 0 || redir >= size) {
        console.warn('Error in decoding compressed grid');
        return null;
      }
      dataY = data[redir];
      dataYLen = dataY.length;
    }
    var codeX = 0;
    if (dataYLen === size) {
      codeX = dataY.charCodeAt(x);
    } else if (dataYLen === 1) {
      codeX = dataY.charCodeAt(0);
    } else {
      for (var pos = 0, x0 = x; pos < dataYLen - 1; pos += 2) {
        x0 -= utfDecode(dataY.charCodeAt(pos + 1));
        if (x0 < 0) {
          codeX = dataY.charCodeAt(pos);
          break;
        }
      }
    }
    // decode
    //console.log("codeX"+codeX);
    var idx = utfDecode(codeX);
    //console.log("idx "+idx.isNaN());
    if (!idx.isNaN()) {
      if (keys.length > idx) {
        var key = keys[idx];
        if (key === '') {
          return {};
        }
        if (typeof attrs === 'undefined') {
          if (worldAttr.hasOwnProperty(key)) {
            return worldAttr[key];
          }
        } else if (attrs.hasOwnProperty(key)) {
          return attrs[key];
        }
      }
    }
    console.warn('Error in decoding grid data.');
    return null;
  }

  grid.getCode = function (lat, lng, callback) {
    var x = long2tile(lng, elezoom) - elex;
    var y = lat2tile(lat, elezoom) - eley;

    // check error in parameters
    if ((!isInt(x)) || (!isInt(y)) || (x < 0) || (y < 0) ||
        (x >= size) || (y >= size)) {
      console.warn('Error in arguments to retrieve grid');
      callback('Error in input coordinates: out of range');
      return;
    }
    var attr = getAttr(x, y);
    if (attr !== null) {
      var code = 'None';
      if (attr.hasOwnProperty('code')) {
        code = attr.code;
        if (attr.hasOwnProperty('subcode')) {
          code = code + ':' + attr.subcode;
        }
      }
      callback(null, code);
      return;
    }
    callback('Error reading geocode data');
    return;
  };
  return grid;
};

// Manage grids of one zoom level
Zoomgrids = function (zlist) {
  var zoomgrids = {},
      zGrids = [],
      zoom = zlist[0],
      nextZoomgrids;

  if (zlist.length > 1) {
    nextZoomgrids = Zoomgrids(zlist.slice(1));
  }

  function getGrid(x, y, callback) {
    // check if already loaded
    for (var i = 0; i < zGrids.length; i++) {
      if ((zGrids[i].x === x) && (zGrids[i].y === y)) {
        callback(null, zGrids[i]);
        return;
      }
    }
    // append zoom, x, y into zGrids and return
    retrieveGrid(x, y, function (error, rGrid) {
      if (!error) {
        zGrids.push(rGrid);
        callback(null, rGrid);
        return;
      }
      callback(error);
    });
    return;
  }

  function retrieveGrid(x, y, callback) {
    // Get json tile path
    var cellx = Math.floor(x / Math.pow(2, zoom - cellzoom));
    var celly = Math.floor(y / Math.pow(2, zoom - cellzoom));

    if ((typeof jsonCache[cellx] !== 'undefined') &&
        (typeof jsonCache[cellx][celly] !== 'undefined') &&
        (typeof jsonCache[cellx][celly][zoom] !== 'undefined')) {
      // Cache hit
      handleJson(x, y, jsonCache[cellx][celly][zoom], callback);
      return;
    }

    //Cache miss

    var tilePath = gridPath + cellx.toString() + '/' + celly.toString()
        + '.json';
    console.log("tilepath: "+ tilePath);
    loadjson(tilePath, function (error, json) {
      if (error) {
        callback('Grid data loading error.');
        return console.warn('Error loading grid tile data: ' + error);
      }
      if (typeof json[zoom] !== 'undefined') {
        handleJson(x, y, json[zoom], callback);
        if (typeof jsonCache[cellx] === 'undefined') {
          jsonCache[cellx] = {};
        }
        jsonCache[cellx][celly] = json;
      } else {
        callback('Zoom level ' + zoom.toString() + ' not in loaded data.');
        return console.warn(
            'Zoom level ' + zoom.toString() + ' not in loaded data.');
      }
    });
    return null;
  }

  function handleJson(x, y, json, callback) {
    if ((typeof json[x] !== 'undefined') &&
        (typeof json[x][y] !== 'undefined')) {
      var rGrid = Grid(x, y, zoom, json[x][y]);
      callback(null, rGrid);
    } else {
      callback('Grid tile not found in loaded data.');
      return console.warn('Grid tile ' + zoom.toString() + '/' +
          x.toString() + '/' + y.toString() +
          ' not found in loaded data.');
    }
    return null;
  }

  zoomgrids.getCode = function (lat, lng, callback) {
    console.log("entered zoomgrids.getCode");
    var response;
    var x = long2tile(lng, zoom),
        y = lat2tile(lat, zoom);

    getGrid(x, y, function (error, rGrid) {
      if (!error) {
        rGrid.getCode(lat, lng, function (error, result) {
          if (!error) {
            if (result === '*') {
              // Search in nextzoomGrids
              response = nextZoomgrids.getCode(lat, lng, callback);
            } else {
              response = callback(error, result);
            }
          } else {
            response = callback(error, result);
          }
          return;
        });
      } else {
        response = callback('Error getting grid data: ' + error);
      }
      return;
    });
    return response;
  };
  return zoomgrids;
};

// Public function for retrieving country codes
// First parameter (optional): URL path to the tiles directory
// Second parameter (optional): worldGrid object (parsed JSON)
CodeGrid = function (path, wgrid) {
  var codegrid = {},
      zoomGrids,
      worldGrid,
      initialized = false,
      initializing = true,
      pendingcb = [];

  if (path) {
    gridPath = path;
  } else if ((typeof __dirname !== 'undefined') && fs.readFile) {
    // points to directory in node module
    gridPath = __dirname + '/' + gridPath;
  }

  if (wgrid) {
    loadWorldJSON(wgrid);
  } else {
    initWorldGrid();
  }

  zoomGrids = Zoomgrids(zList);

  function initWorldGrid() {
    var worldPath = gridPath + worldFile;
    loadjson (worldPath, function (error, json) {
      if (error)
        return console.warn('Error loading geocoding data: ' + error);
      loadWorldJSON (json);
      // Clear pending calls to getCode
      var param;
      while (param = pendingcb.shift()) {
        codegrid.getCode (param[0], param[1], param[2]);
      }
      return null;
    });

    /*loadWorldJSON(JSON.parse(jsonFile));
    // Clear pending calls to getCode
    var param;
    while (param = pendingcb.shift()) {
      codegrid.getCode(param[0], param[1], param[2]);
    }
    return null;*/

  }

  function loadWorldJSON(json) {
    console.log("Entered Load World Json");
    worldAttr = json.data;
    worldGrid = Grid(0, 0, 0, json);
    if (worldGrid !== null) {
      initialized = true;
    }
    initializing = false;
  }

  function responseCallback(error, res) {
    if (error) {
      console.log("  ERROR: Returned: " + error);
    } else {
      console.log("  Success: returned "+ res);
      return res;
    }
  }
  codegrid.getLatLongCode = function (lat, lng) {
    lat = Number(lat);
    lng = Number(lng);
    var callback = responseCallback;
    var response;
    if (!initialized) {
      if (initializing) {
        // Callback after initialization
        pendingcb.push([lat, lng]);
        return;
      }
      console.warn('Error : grid not initialized.');

      return;
    }
    worldGrid.getCode(lat, lng, function (error, result) {
      if (!error) {
        if (result === '*') {
          // Search in zoomGrids
          response =zoomGrids.getCode(lat, lng, callback);
        } else {
          response = callback(error, result);
        }
      } else {
        response =  callback(error, result);
      }
    });
    return response;
  };

  codegrid.getCode = function (lat, lng, callback) {
    console.log("entered here")
    var response = null;
    if (!initialized) {
      if (initializing) {
        // Callback after initialization
        pendingcb.push([lat, lng, callback]);
        return;
      }
      console.warn('Error : grid not initialized.');
      callback('Error: grid not initialized.');
      return;
    }
    worldGrid.getCode(lat, lng, function (error, result) {
      if (!error) {
        if (result === '*') {
          // Search in zoomGrids
          response = zoomGrids.getCode(lat, lng, callback);
        } else {
          response = callback(error, result);

        }
      } else {
        response = callback(error, result);
      }
      return;
    });
    console.log("response "+response);
    return response;
  };
  return codegrid;
};

var c

// Utility functions
// http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
function long2tile(lon, zoom) {
  // http://javascript.about.com/od/problemsolving/a/modulobug.htm
  return (Math.floor(
      (((((lon + 180) / 360) % 1) + 1) % 1) * Math.pow(2, zoom)));
}

var latlimit = Math.atan((Math.exp(Math.PI) - Math.exp(-Math.PI)) / 2) / Math.PI
    * 180;

function lat2tile(lat, zoom) {
  if (Math.abs(lat) >= latlimit) {
    return -1;
  }
  return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) +
      1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
}

function loadjson(path, callback) {

  var FileReader = Java.type("java.io.FileReader");
  var JSONParser = Java.type("org.json.simple.parser.JSONParser");
  try{
    var reader = new FileReader(path);
    var parser = new JSONParser();
    var obj = parser.parse(reader);
    var employeeList = obj;
    var result = JSON.parse(employeeList.toJSONString());
    callback(null, result);
  }catch (e) {
    console.log(e);
  }



  /* if (fs) {
     fs.readFile(path, function (e, data) {
       if (!e) {
         var result = JSON.parse(data);
         callback(null, result);
       } else {
         if (e.code === 'ENOENT') {
           console.warn('File ' + path + ' not found.');
           callback('File ' + path + ' not found.');
         } else {
           console.warn(e.message);
           callback(e.message);
         }
       }
     });
   }*/

}

// ----------------

var jsonFile = "{\"keys\":[\"\",21,7,1,2,246,3,91,112,90,254,265,77,116,92,114,115,78,146,119,93,183,82,32,196,121,202,94,80,118,79,120,97,122,148,98,130,40,96,123,224,128,147,124,185,68,132,165,195,149,127,126,129,184,223,83,167,131,166,171,193,225,84,103,192,170,136,168,194,67,150,198,175,102,9,236,169,151,172,188,203,12,205,207,69,190,219,186,204,70,187,23,66,104,138,31,137,215,209,221,22,25,258,237,208,26,48,177,15,54,242,176,10,13,55,46,42,71,264,14,86,11,17,255,155,216,248,45,105,41,73,179,24,60,72,178,257,106,108,16,19,88,139,152,206,260,75,87,58,89,226,76,256,211,210,59,65,266,35,140,109,180,111,154,18,241,110,228,262,20,157,240,252,239,141,229,263,268,144,214,36,158,161,181,250,234,182,259,253,231,6,5,251,162,142,232,243,37,143,235,61,261,267,39,145,238,244,164,62,249,247,245],\"data\":{\"1\":{\"code\":\"*\"},\"2\":{\"code\":\"ru\"},\"3\":{\"code\":\"us\"},\"4\":{\"subcode\":\"um\",\"code\":\"us\"},\"5\":{\"code\":\"as\"},\"6\":{\"code\":\"ws\"},\"7\":{\"code\":\"ca\"},\"8\":{\"code\":\"us;ca\"},\"9\":{\"code\":\"mx\"},\"10\":{\"code\":\"gt\"},\"11\":{\"code\":\"sv\"},\"12\":{\"code\":\"bs\"},\"13\":{\"code\":\"hn\"},\"14\":{\"code\":\"ni\"},\"15\":{\"code\":\"bz\"},\"16\":{\"code\":\"cr\"},\"17\":{\"code\":\"co\"},\"18\":{\"code\":\"ec\"},\"19\":{\"code\":\"pa\"},\"20\":{\"code\":\"pe\"},\"21\":{\"code\":\"gl\"},\"22\":{\"code\":\"ht\"},\"23\":{\"code\":\"cu\"},\"24\":{\"code\":\"ve\"},\"25\":{\"code\":\"do\"},\"26\":{\"code\":\"jm\"},\"27\":{\"subcode\":\"cw\",\"code\":\"nl\"},\"28\":{\"subcode\":\"aw\",\"code\":\"nl\"},\"29\":{\"subcode\":\"bq\",\"code\":\"nl\"},\"30\":{\"code\":\"pr\"},\"31\":{\"code\":\"tc\"},\"32\":{\"code\":\"nl\"},\"33\":{\"code\":\"cw\"},\"34\":{\"subcode\":\"pr\",\"code\":\"us\"},\"35\":{\"code\":\"br\"},\"36\":{\"code\":\"bo\"},\"37\":{\"code\":\"cl\"},\"38\":{\"code\":\"cl;pe\"},\"39\":{\"code\":\"ar\"},\"40\":{\"code\":\"pm\"},\"41\":{\"code\":\"gd\"},\"42\":{\"code\":\"dm\"},\"43\":{\"code\":\"mq\"},\"44\":{\"code\":\"lc\"},\"45\":{\"code\":\"vc\"},\"46\":{\"code\":\"gp\"},\"47\":{\"subcode\":\"vi\",\"code\":\"us\"},\"48\":{\"code\":\"vg\"},\"49\":{\"code\":\"ai\"},\"50\":{\"code\":\"mf\"},\"51\":{\"code\":\"bl\"},\"52\":{\"subcode\":\"sx\",\"code\":\"nl\"},\"53\":{\"code\":\"kn\"},\"54\":{\"code\":\"ag\"},\"55\":{\"code\":\"ms\"},\"56\":{\"code\":\"bq\"},\"57\":{\"code\":\"sx\"},\"58\":{\"code\":\"gy\"},\"59\":{\"code\":\"sr\"},\"60\":{\"code\":\"tt\"},\"61\":{\"code\":\"py\"},\"62\":{\"code\":\"uy\"},\"63\":{\"code\":\"ar;py\"},\"64\":{\"code\":\"ar;uy\"},\"65\":{\"code\":\"gf\"},\"66\":{\"code\":\"eh;ma\"},\"67\":{\"code\":\"ma\"},\"68\":{\"code\":\"es\"},\"69\":{\"code\":\"mr\"},\"70\":{\"code\":\"ml\"},\"71\":{\"code\":\"sn\"},\"72\":{\"code\":\"gn\"},\"73\":{\"code\":\"gw\"},\"74\":{\"code\":\"gm\"},\"75\":{\"code\":\"sl\"},\"76\":{\"code\":\"lr\"},\"77\":{\"code\":\"gb\"},\"78\":{\"code\":\"ie\"},\"79\":{\"code\":\"gg\"},\"80\":{\"code\":\"fr\"},\"81\":{\"code\":\"je\"},\"82\":{\"code\":\"im\"},\"83\":{\"code\":\"pt\"},\"84\":{\"code\":\"dz\"},\"85\":{\"code\":\"gi\"},\"86\":{\"code\":\"bf\"},\"87\":{\"code\":\"ci\"},\"88\":{\"code\":\"gh\"},\"89\":{\"code\":\"tg\"},\"90\":{\"code\":\"se\"},\"91\":{\"code\":\"no\"},\"92\":{\"code\":\"dk\"},\"93\":{\"code\":\"de\"},\"94\":{\"code\":\"be\"},\"95\":{\"code\":\"lu\"},\"96\":{\"code\":\"it\"},\"97\":{\"code\":\"at\"},\"98\":{\"code\":\"ch\"},\"99\":{\"code\":\"ad\"},\"100\":{\"code\":\"li\"},\"101\":{\"code\":\"mc\"},\"102\":{\"code\":\"ly\"},\"103\":{\"code\":\"tn\"},\"104\":{\"code\":\"ne\"},\"105\":{\"code\":\"ng\"},\"106\":{\"code\":\"bj\"},\"107\":{\"code\":\"ne;ml\"},\"108\":{\"code\":\"cm\"},\"109\":{\"code\":\"gq\"},\"110\":{\"code\":\"ga\"},\"111\":{\"code\":\"cg\"},\"112\":{\"code\":\"fi\"},\"113\":{\"subcode\":\"ax\",\"code\":\"fi\"},\"114\":{\"code\":\"lv\"},\"115\":{\"code\":\"lt\"},\"116\":{\"code\":\"ee\"},\"117\":{\"code\":\"ax\"},\"118\":{\"code\":\"cz\"},\"119\":{\"code\":\"pl\"},\"120\":{\"code\":\"sk\"},\"121\":{\"code\":\"ua\"},\"122\":{\"code\":\"hu\"},\"123\":{\"code\":\"hr\"},\"124\":{\"code\":\"ba\"},\"125\":{\"code\":\"si\"},\"126\":{\"code\":\"al\"},\"127\":{\"code\":\"me\"},\"128\":{\"code\":\"rs\"},\"129\":{\"code\":\"mk\"},\"130\":{\"code\":\"ro\"},\"131\":{\"code\":\"gr\"},\"132\":{\"code\":\"bg\"},\"133\":{\"code\":\"ba;hr\"},\"134\":{\"code\":\"va\"},\"135\":{\"code\":\"sm\"},\"136\":{\"code\":\"mt\"},\"137\":{\"code\":\"td\"},\"138\":{\"code\":\"sd\"},\"139\":{\"code\":\"cf\"},\"140\":{\"code\":\"cd\"},\"141\":{\"code\":\"ao\"},\"142\":{\"code\":\"na\"},\"143\":{\"code\":\"bw\"},\"144\":{\"code\":\"zm\"},\"145\":{\"code\":\"za\"},\"146\":{\"code\":\"by\"},\"147\":{\"code\":\"ua;ru\"},\"148\":{\"code\":\"md\"},\"149\":{\"code\":\"tr\"},\"150\":{\"code\":\"cy\"},\"151\":{\"code\":\"eg\"},\"152\":{\"code\":\"ss\"},\"153\":{\"code\":\"sd;td\"},\"154\":{\"code\":\"ug\"},\"155\":{\"code\":\"et\"},\"156\":{\"code\":\"ss;sd\"},\"157\":{\"code\":\"tz\"},\"158\":{\"code\":\"mw\"},\"159\":{\"code\":\"bi\"},\"160\":{\"code\":\"rw\"},\"161\":{\"code\":\"mz\"},\"162\":{\"code\":\"zw\"},\"163\":{\"code\":\"sz\"},\"164\":{\"code\":\"ls\"},\"165\":{\"code\":\"ge\"},\"166\":{\"code\":\"am\"},\"167\":{\"code\":\"az\"},\"168\":{\"code\":\"sy\"},\"169\":{\"code\":\"jo\"},\"170\":{\"code\":\"iq\"},\"171\":{\"code\":\"ir\"},\"172\":{\"code\":\"sa\"},\"173\":{\"code\":\"ps\"},\"174\":{\"code\":\"il\"},\"175\":{\"code\":\"lb\"},\"176\":{\"code\":\"er\"},\"177\":{\"code\":\"ye\"},\"178\":{\"code\":\"dj\"},\"179\":{\"code\":\"so\"},\"180\":{\"code\":\"ke\"},\"181\":{\"code\":\"km\"},\"182\":{\"code\":\"yt\"},\"183\":{\"code\":\"kz\"},\"184\":{\"code\":\"tm\"},\"185\":{\"code\":\"uz\"},\"186\":{\"code\":\"ae\"},\"187\":{\"code\":\"om\"},\"188\":{\"code\":\"kw\"},\"189\":{\"code\":\"bh\"},\"190\":{\"code\":\"qa\"},\"191\":{\"code\":\"tm;uz\"},\"192\":{\"code\":\"af\"},\"193\":{\"code\":\"tj\"},\"194\":{\"code\":\"pk\"},\"195\":{\"code\":\"kg\"},\"196\":{\"code\":\"cn\"},\"197\":{\"code\":\"kg;kz\"},\"198\":{\"code\":\"in\"},\"199\":{\"code\":\"kg;uz\"},\"200\":{\"subcode\":\"hm\",\"code\":\"au\"},\"201\":{\"code\":\"hm\"},\"202\":{\"code\":\"mn\"},\"203\":{\"code\":\"np\"},\"204\":{\"code\":\"bd\"},\"205\":{\"code\":\"bt\"},\"206\":{\"code\":\"lk\"},\"207\":{\"code\":\"mm\"},\"208\":{\"code\":\"th\"},\"209\":{\"code\":\"la\"},\"210\":{\"code\":\"id\"},\"211\":{\"code\":\"my\"},\"212\":{\"subcode\":\"cx\",\"code\":\"au\"},\"213\":{\"subcode\":\"cc\",\"code\":\"au\"},\"214\":{\"code\":\"au\"},\"215\":{\"code\":\"vn\"},\"216\":{\"code\":\"kh\"},\"217\":{\"code\":\"sg\"},\"218\":{\"subcode\":\"hk\",\"code\":\"cn\"},\"219\":{\"code\":\"tw\"},\"220\":{\"subcode\":\"mo\",\"code\":\"cn\"},\"221\":{\"code\":\"ph\"},\"222\":{\"code\":\"bn\"},\"223\":{\"code\":\"kp\"},\"224\":{\"code\":\"jp\"},\"225\":{\"code\":\"kr\"},\"226\":{\"code\":\"pw\"},\"227\":{\"code\":\"tl\"},\"228\":{\"code\":\"pg\"},\"229\":{\"code\":\"sb\"},\"230\":{\"code\":\"um\"},\"231\":{\"code\":\"vu\"},\"232\":{\"code\":\"nc\"},\"233\":{\"subcode\":\"nf\",\"code\":\"au\"},\"234\":{\"code\":\"mg\"},\"235\":{\"code\":\"mu\"},\"236\":{\"code\":\"bm\"},\"237\":{\"code\":\"ky\"},\"238\":{\"code\":\"pn\"},\"239\":{\"code\":\"tv\"},\"240\":{\"code\":\"sc\"},\"241\":{\"code\":\"st\"},\"242\":{\"code\":\"cv\"},\"243\":{\"code\":\"nu\"},\"244\":{\"code\":\"nz\"},\"245\":{\"code\":\"bv\"},\"246\":{\"code\":\"sj\"},\"247\":{\"code\":\"gs\"},\"248\":{\"code\":\"gu\"},\"249\":{\"code\":\"fk\"},\"250\":{\"code\":\"tf\"},\"251\":{\"code\":\"to\"},\"252\":{\"code\":\"io\"},\"253\":{\"code\":\"wf\"},\"254\":{\"code\":\"is\"},\"255\":{\"code\":\"bb\"},\"256\":{\"code\":\"mv\"},\"257\":{\"code\":\"pf\"},\"258\":{\"code\":\"mp\"},\"259\":{\"code\":\"fj\"},\"260\":{\"code\":\"fm\"},\"261\":{\"code\":\"ck\"},\"262\":{\"code\":\"nr\"},\"263\":{\"code\":\"sh\"},\"264\":{\"code\":\"mh\"},\"265\":{\"code\":\"fo\"},\"266\":{\"code\":\"ki\"},\"267\":{\"code\":\"re\"},\"268\":{\"code\":\"tk\"}},\"grid\":[\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \u00ed!. \u014a\",\" \u00ea!4 \u0147\",\" \u00e7!8 \u0146\",\" \u00e4!< \u0145\",\" \u00e1!@ \u0144\",\" \u00b3#\/ @!B \u0143\",\" \u00b1#3 <!E \u0142\",\" \u00af#8 8!G \u0141\",\" \u00ad#= 4!I \u0140\",\" \u00ac#? 1!L \u013f\",\" \u00aa#B \/!N \u013e\",\" \u00a9#C -!Q \u013d\",\" \u00a7#F +!S \u013c\",\" \u00a6#H (!V \u013b\",\" \u00a5#I '!X \u013a\",\" \u00a5#J $![ \u0139\",\" \u00a4#K!` \u0138\",\" \u00a2#K$#!b \u0136\",\" \u00a0#L$#!d \u0135\",\" \u009f#L$#!f \u0086%% \u00cc\",\" \u009e#M$!!h \u0083%+ \u00c8\",\" \u009d#M$#!i \u0082%- \u00c6\",\" \u009c#M$#!k \u0080%\/ \u00c5\",\" \u009b#N$!!m ~%0 \u00c5\",\" \u009a#N$#!m |%3 \u00c4\",\" \u009a#N$!!o z%4 I%% \u0098\",\" \u0099#N$#!o u%% !%5 @%. \u0097\",\" \u0099#N$!!p t%; @%. \u0097\",\" \u0098#N$#!o u%; 1%% ,%\/ \u0096\",\" \u0098#M$#!p J&% C%? 0%' +%\/ \u0096\",\" \u0098#L$#!p K&& A%@ 0%' +%0 \u0095\",\" \u0097#L$#!p K&- 9%B 0%' ,%0 \u0094\",\" \u0097#L$!!p K&\/ 8%B 0%' .%. \u0094\",\" \u0097#K$#!p J&0 8%A 2%$ 0%. \u0094\",\" \u0095#L$#!p K&1 %&& .%@ D%. \u0095\",\" \u0092#O$!!p K&3 #&(%% )%= G%. \u0095\",\" \u0091#P$!!o H&8 !&(%% +%: H%0 \u0093\",\" \u0090#P$#!n E&< !&(%& +%9 G%2 \u0092\",\" \u008e#R$!!o D&= !&' !%% ,%8 H%2 \u0092\",\" \u008d#R$#!n D&> !&& $%# .%7 4%$ 3%2 \u0091\",\" \u008c#S$!!o D&= =%' '%' 4%' 0%3 \u0091\",\" \u008b#S$#!o D&< J%& 5%' 0%5 \u008f\",\" \u0089#S$$!p D&< d%' 0%6 \u008e\",\" \u0087#T$#!r D&; f%& 0%7 \u008d\",\" \u0086#T$#!s D&: #&& a%% 2%6 \u008c\",\" \u0084#V$!!s E&A v%7 \u008b\",\" \u0082#X$!!s E&A v%7 \u008b\",\" \u0081#Y$#!r E&6 #&* w%7 \u008a\",\" \u0080#Z$#!r E&5 $&) ~%1 \u008a\",\" ~#]$!!s E&6 #&( \u0080%1 \u0089\",\" }#]$#!s F&5 $&$ ~%$ $%1 \u0088\",\" }#]$!!t F&6 \u0082%% %%1 \u0087\",\" |#^$!!t G&6 \u0081%% %%1 \u0087\",\" |#^!u H&6 \u0081%$ %%1 \u0087\",\" {#_!u I&6 \u0088%0 \u0087\",\" y#` !!u J&5 \u0088%$ !%* \u0089\",\" w#a #!u J&4 \u008d%, \u0087\",\" v#a $!u J&3 \u0086%$ #%\/ \u0087\",\" v#a $!u J&* !&( ^%$ E%' !%\/ \u0087\",\" u#b $!u J&* #&' [%' D%6 \u0087\",\" t#c $!u K&( $&& !&$ W%) B%< \u0082\",\" s#d $!u L&' $&% !&% W%) A%? \u0080\",\" r#e $!u M&& %&# #&% U%+ A%@ \",\" q#f %!t M&& )&% P%0 A%@ B%' W\",\" q#e (!r N&$ *&$ O%1 ?%C A%) V\",\" q#e *!p \u008b%2 >%E =%. T\",\" q#e +!o \u008a%1 <%$ !%E <%1 R\",\" q#e -!m \u008a%0 <%J <%4 O\",\" q#d 9!b \u0089%\/ >%J <%7 L\",\" q#d :!a \u0087%\/ 8%$ $%K =%: I\",\" p#e ;!` \u0087%- :%$ $%K =%: I\",\" p#e ;!` \u0087%, ;%$ #%L ?%8 I\",\" p#e <!` \u0086%+ 8%$ !%P A%7 I\",\" o#f <!` P&% Q%, 8%% $%N A%, $%( I\",\" o#e =!_ Q&% Q%+ 9%% $%R :%# !%( )%% K\",\" o#e >!^ Q&% Q%* ;%$ !%T 9%% $%% W\",\" o#e >!] S&# Q%* ?%U (%& -%% $%' U\",\" o#g <!] \u0085%+ ?%U (%' ,%% $%( T\",\" o#i :![ \u0086%* 0%$ !%( $%Z %%* *%$ $%( T\",\" o#i :![ \u0086%* \/%k $%+ .%* S\",\" o#j 9!Z \u0086%* 0%y -%* S\",\" o#j :!Y \u0086%) 0%{ -%) S\",\" n#l 9!X \u0086%* 0%{ .%( S\",\" n#l 9!X \u0086%) 1%{ ,%- P\",\" n#m 8!W \u0087%) 0%| ,%1 L\",\" n#n 7!W \u0086%) 1%| +%3 K\",\" m#o 8!V \u0086%) 1%| !%% &%4 J\",\"%$ j#r 5!V \u0086%) 1%| !%% !%8 I%!\",\"%% ='$ H#t 4!V \u0086%* \/%} !%> G%#\",\"%& ;'' F#t 4!V 0&$ M(( @%* .%\u009d E%$\",\"%& 9', B#w 2!V \/&% K(+ @%* ,%\u00ac 7%$\",\"%& 7'\/ A#x 1!V \/&% I(\/ >%+ +%\u00ad 6%$\",\"%% 8'5 9#{ 1!U \/&% G(2 >%, )%\u00ad 6%$\",\" 9': 5#~ 0!U V(6 >%, (%\u00ad 6%# !\",\" 9'? \/# 0!U V(5$! @%+ '%\u00aa *%* *\",\" 8'B (#$ !#\u0081 \/!U U(.$%($$!%$ C%) %%\u00a9 $%# $%0 %\",\" 8'A$!#% ##\u0086 \/!U T(.$#)#$&%$ 6%# ,%+ #%\u00c2 #\",\" 8'A$!#\u008c \/!T S(0$!)%$%%' 2%% +%\u00d0\",\"%! 6'B$!#\u008c 0!R S(*$$(%$!)$$$%+ \/%' $%# %%\u00d0\",\"%$ 0'F$!#\u008c 0!Q S(*$%(%$!)$$#%- .%' !%\u00d8\",\"%% \/'F$!#\u008d \/!P T(*$*)$$!%\/ #%* !%\u00df\",\"%& -'G$!#\u008d \/!O T(($%*!$%)!$!)%$!%\u00f9\",\"%' ,'G$!#\u008f -!N T()$!*!$#*$$#)'$#%: $%\u00dc\",\"%( -'E$!#\u0090 -!K V('$$*'$#)($#%\u00f7\",\"%* ,'D$!#\u0091 ,!G Y(($!**$!))$!%\u00f7\",\"%* -'C$!#\u0092 +!C 2+! K('$#**$!))$!%\u00f7\",\"%. *'B$!#\u0093 *!B 2+$ J(($!**$!)($#%\u00f7\",\"%\/ )'B$!#\u0094 )!A 3+$ J('$#**$#)'$!%\u00f8\",\"%\/ &'E$!#\u0094 )!A -+$ %+( E(&$#*+$#)'$!%\u00f8\",\"%1 #'F$!#\u0094 )!@ -+1 C('$#*+$!)($#%\u00f7\",\"%0$!'H$!#\u0094 )!? .+1 C(&$#*,$#)($!%\u00f7\",\"%0$!'H$!#\u0093 +!> -+3 B(&$!*.$!)($!%\u00f7\",\"%0$!'H$!#\u0093 +!< \/+3 A('$!*.$!)($!%\u00f7\",\"%\/ #'H$!#\u0092 ,!: 1+3 A('$!*.$!)($!%\u00f7\",\"%# $%( %'H$!#\u0091 -!7 5+2 @('$#*-)*$!%\u00f7\",\"%! %%( ''F$!#\u0091 .!5 6+2 @('$#*,)+$!%\u00f7\",\" (%& ''F$!#\u0090 \/!5 8+\/ @()$!*,)+$#%\u00f5 !\",\" )%$'% *'@$!#\u0090 \/!5 7+\/ @('$%*+)-$!%\u00f5 !\",\" +'' ('A$!#\u0090 0!4 7+- A(($!*,$#),$#%\u00f5 !\",\" +'( %'C$!#\u0090 0!4 8+! #+' B()$!*+$#).$#%\u00f5\",\" ,'' $'D$!#\u0091 0!2 <+% C(*$!*+$!)0$!%\u00f5\",\"%! -'% $'D$!#\u0091 0!1 c(+$!*+)1$!%\u00f5\",\"%! 3'E$!#\u0090 2!0 P,$ \/(,$!** #)\/$#%\u00f5\",\" 4'E$!#\u0090 2!\/ P,% \/(,$!*) $)\/$!%\u00f2 !%$\",\" 4'E$!#\u008f 4!. Q,$ .(-$!*) $).$#%\u00f0 '\",\" 4'E$!#\u008f 4!. Q,# \/(-$#*( $)-$#%\u00f0 (\",\" 4'E$!#\u008f 5!- Z-# &(-$#*( $),$#%\u00d8 #%6 *\",\" *'$ ('E$!#\u008f 5!- Y-$ &(-$!**$%))$#%\u00d8 $%5 +\",\" *'$ &'G$%#\u008d 5!, X-% '(,$!**$%)($#%\u00d9 %%3 ,\",\" *'$ &'G$%#\u008d 6!* Y-% '(+$#**$%)'$#%\u00d8 (%, !%% -\",\" 2'J$###$##\u0088 9!' X-% ((+$#**$%)#$$.!$$%\u00d8 &%, $%# .\",\" 7'7 $'# ''%$'#\u0088 :!$ T-* ((+$!*,$%.($#%\u00d7 %%+ 5\",\" :'3 \/'$$#'#$##\u0088 p-) )(*$#*, #.)$#%\u00d8 %%* 6\",\" 9'2 3''$##\u0087 n-* +()$!*- #.)$#%\u00c5 +%& (%+ 6\",\" :'1 3'($!#\u0088 l-+ +(( !*\/ !.&$!.$$!%\u00c4 6%, 7\",\" @'+ 5'&$##\u0088 d-! '-, +(&\/#$!*. !$).!$!%\u00c3 6%- 7\",\" .'# 0', 5''$!#\u0088 d-! '-- .\/$$#*, #0#$#0$$$%\u00c3 6%, 8\",\" .'# \/', 7'&$##\u0087 l-+ .\/&$!*, !0+$!%\u00c2 6%- 8\",\" .'$ ,'- 8''$##\u0086 l-+ .\/&$!*+ #0+$#%\u00c0 7%- 8\",\" \/'# +') !'$ :''$##\u0086 k-* \/\/'$!*( %0!$'0$$#%\u00bf 7%. 8\",\" 9'- <'($##\u0085 l-+ -\/'$#*& &$#1%$*%\u00bb 8%. 8\",\" 8'. =''$##\u0087 h2$$!-) ,\/($#*!$!\/!$! '$!1($#3#$%%V$#%\u0082 9%, %%# 4\",\" 6'+ C'&$##\u0089 f2#$#-) -$#\/%$#*!$!\/# !4$%#$%1%$#3%$#%T$'%\u0082 7%- $%% 2\",\" 5', C'%$##\u008b d2#$#-+ ,5!$%\/!$#5!\/#4&$!%%$!1$$#3&$#%P$'6#$#%\u0082 %%# 1%- $%& 1\",\" 3'* #'! E$%#\u008c b2%$$-!$$-' *5'$#5#$!4'$(1!$#3($!%M$&6'$$%%$$%| !%$ 1%, &%% 1\",\" 1'( !'# I#\u0091 a2&$%7!$!-' )5,$!4-$%3($$%H$%6,$%%!$%%\u0080 2%) <\",\" 0'' N#\u0092 `2)-* &8$$#5*$!4-$!3-$!%H$#61$$6#$#%_$&%= 1%) <\",\" .'( O#\u0092 `2)-, $8$$#5*$!4-$#3*$$%H$$66$#%]$#9$$$%; 1%) 0'& (\",\" ('# !'( S#$ !#\u008d a2(-, #8%$#5*$!4-$#3*$#%I$!69$!%[$#9'$#%: 1%( 1'( &\",\"'\/ W#\u0090 `2)-, #8%$#5*$!4,$#3*$'%E$#69$#%<$!%?$!9($!%: 1%& 5'+\",\"', Z#$ !#\u008c `2($!-, !8%$#5+$!4-$*3!$$:#$!%7$%%+$#6:$!%;$&%;$#9($#%9 2%% :'&\",\"'' e#\u008b `2& #-,$(5,$#4,$#:$$':%$#%5$(%*$#69$%%8$!;$$$%9$!9*$!%9 2%% <'$\",\"'# h#\u008c h-*$%<$$!5+$%4+$#:\/$#%3$#6&$)%!$$6:$(%,$#%'$!;&$!%8$#9*$#%8 0%& >'#\",\" j#\u008c g-+$!=!$$<#$#5($$>#$%4($#:0$%%.$$6($$6$$%6>$#6!$!%*$'%%$!;&$#%!$%%2$!9,$!%8 \/%& A\",\" k#\u008d d-'?!$!=($#<!$#5($!>&$%4&$#:2$&%+$%6R$$%&$$;%$';'$$;#$$%($&%#$#9,$!%9 .%% B\",\" l#O$!#^ c-$ #?!$#=)$%5($#>($(:7$$%)$!6!$!6U$$%!$$;*$#;\/$#%$$%;$$%9-$%%6 .%$ C\",\" m#&$K#] f=#$$=,$$5'$#>!$#>#$#@!$&:8$#%)$!6Y$$;=$';&$!92$$%6 +%% D\",\" n##$!#!$#'H$%#Z d=%$#=.$!5($(@$$$:($!:1$#%)$!6X$%;G$#94$!%6 +%% D\",\" p$$'L$)#S d=3$#5'$#A$$#@!$):$$&:\/$!%*$#6V$#9#$$;E$!9#$#91$#%!$%%) !%$ !%# +%$ E\",\" p'S$!'#$$#Q d=3$*A%$%B%$*C!$!:-$$%*$$6U$!9%$$;D$'90$%9#$!%) !%$ -%$ F\",\" p'X$##6$%#0$!#' f=0$#D#$'A%$!B'$#E($!C!$#:,$!%.$#6Q$#6!$!9'$#;H$#94$#%( #%% +%$ G\",\" p'Y$##5$!'#$!#, %F!$!#& h=-$#D$$(A!$$B'$!E)$#C!$!:+$#%.$#6P$&9($!;E$&94$!%( $%% )%% H\",\" q'Y$$#3$!'#$!#- (## i=-$#D!$%G$$(B#$%E)$%:%$#:$$#%0$#6! $6K$!9,$!;D$$97$!%( $%% (%% I\",\" q'Z$##2$#'#$##, s=-$%G'$%H!$'E*$$:$$)%2$!6! !6+$!6B$!9+$#;C$#98$#%' $I!$!%$ &%& J\",\" q'[$##0$#'$$##+ t=-$#G($+J!$#E)$%:! !K&$$%2 #6)$&6>$%9+$$;=$!;#$$97$$%' %I% &%& K\",\" q']$!#*$('&$!#* u=-$#G($!H$$#L!$$J#$$E*$!:! #K&$#%0 $6)$#M$$$6;$#90$&;8$&98$%%& &I% $%& M\",\" q']$##($#',$!#( w=-$#G)H$$#L$$!J$$#E&$!E% %K$ #%2 #6)$!M'$#6;$!94$#;7$!9<$!%) &I'$#%# O\",\" p'_$!#$$&'- !#% pN+$!=-$!G'$!G#H$$#L#$!J$$, -%$$!%, #6)$!M($'66$!95$#;6$#9;$!%( &I($#%# O\",\" p'^$##$$!'\/ $#$ pN,$#=,$!G!=!$!G(H$$&J#$#O* .%!$'%( $6($!M)$#M!$$6+$$6($!96$!;5$#9<$!%' &I*$!%! P\",\" p'^$!#$$#'. wN,$'=$ !=$ !=#$!G(H$$&J#$#O) 0P&$%%% $6($!M#$#M*$#6&$&Q!$(6!$!96$*;+$$9;$$%& 'I+ Q\",\" p']$''\/ wN!$#N.$$N! &=#$#G#$!G%$#H#$(O&$!O# &R& (P%$!P!$#%% %6!$$6!$!M!$&M($#6&$#Q!$#Q($$9>$$;$$'9;$&%$ (I) T\",\" p']$$'2 w$'N\/ &=$ !G#$#G& #S!$!T!$!U#$!O!$!O#$%R! #R* &$$P%$& %$#V!$$M!$!V$$!M($#6$$&Q)$$9A$&9=$&W# ,I) T\",\" q'p xX$$#N. 'G!$#G! #G* !T#$!U!$(R6$+Y# $V%$%V$$%M&$+Q&$$9e$%W# -I& W\",\" p'o zX$$!N- )G% #G+T#$$Z%$#R8$#[!$!Y( #V\/$!M($&M!$$Q!$%9e$$W& .I% W\",\" p'm [X! ?X%$!N, !N% %G% %G)$$Z'$#R8$&Y' #V\/$!M)$(Q!$%9e$#W( .I& V\",\" q'k ]X# >X$$#N1 %G% 'G'Z!$#Z'$#R9$(Y# $V\/$$M%$,9h$!W' 0I& V\",\" q'j ^X# !X% 9X$$#N0 &G% $G# !G& #Z*$!R9$&]!$!Y# %V0$#M$$#^&$%9hW( \/I' V\",\" q'i bX% 9X$$!N. )G$ $G) $Z*$!R9$#]%$# &V&$#V*$$M#$#^#$#^#$$9f #W$$$_! -I( V\",\" r'h cX# !X$ 6X$$#N* 1G) %Z*$#R8$#]' 'V!$'V+$#M!$#^!$$^%$!9e #$&_$ !_# (I) W\",\" r'h fX% 5X$$!N+ )`$ !a% !G' 'Z*$!R5$&]) %$#]%$$V($)b!$!^!$%9f !_!$$_) 'I( X\",\" s'f hX$ 5X$$!N) $`+$#a$G( 'Z*$#R-$*c!$$]4$$V%$#b$$$b#$(9e $_( #_! &I) X\",\" t'e hX# :N#$!N& !`-$!a%G$d!$!G! *Z($&R)$#e&$#c%$!]6$#V#$#b*$#f%$#9d $_( $I$ !I* X\",\" t'f hX! ;$#g#$# !`.$!a% !G#d$ +Z*$#R! !R!$$h!$#e'$!c&$#]5$#V!$$b*$!f'$%9_ &_( $I. X\",\" u'd \u0083g$$&`.$#a%G# \/Z' 'h&e)$!c'$!]5$%b,$!f($$9^ &_($! !I0 X\",\" v'c \u0083g($!`.$!a& 1Z& (h% !$$e%$#c&$#]5$!b.$#f#$'i!$#9] &_'$!I1 Y\",\" v'a \u0083g*$!`-$#a% Cj!$#e$$#c'$!]6$!b-$$f$$!i&$#9] &_'$!I- !I# Z\",\" v'` xX# *g+$!`-$#a%$!k! @j!$#e#$$c($#]5$!b-$#f%$!i&$#9^ &_$ !I. $I# Y\",\" w'$$&'T yX$ )g,$#`-$!a%$!k& 'k' 0$(c*$#]4$!b,$#f&$#i%$#9^ '_# !I+ 'I# Y\",\" zl!$!l#$%'P 5m# dX# *g*$%`-$#a#$#k' &k) .$%n#$$c)$#]3$!b,$!f($#i$$#9_ )I) )I# Y\",\" {l'$$'%$%'E \u0085g*$#`1$%k) %k($#o% !o'$$n!$%p!$#c)$#]2$#b)$$f'$#i%$#9` (I' f\",\" {l)$'l#$#'C \u0086g*$!`3$#k5$!o-$$n!$#p%$%c&$#]3$!b'$$f)$#i&$$9_ (I% g\",\" |l1$#'B ~X! (g($$`3$#k5$!o.$#n#$#p'$!c'$!]2$#b'$!f+$!i)$$9] (I% -I! Y\",\" |l2$!'!$%'= ~X! #N# $g&$$`5$!k6$!o.$&p($#c$$%]1$$b#$%f*$#i)$&9Z (I% g\",\" }l1$$l!$#'2 %'# !'& zN# $N$ #g%$&`5$#k5$!o.$$p+$'q#]2$&f,$#i)$#r$$#9.$&9F )I# i\",\" #'$ xl6$#'( &'% ('& zN) !g%$#`9$#k5$!o.$!p2$$ !]1$#f.$#i*$$r$$$9+$#i$$$9D )I$ h\",\" #'& vl7$#'& 2'' xN($!g'$!`:$#k5$!o.$!p5 !]2$#f*$%i-$$r$$-i%$$9C )I% 0I# V\",\" &'# vl8$!'% 3''s% tN# #N# !g($#`9$#k5$!o.$!p6 !]2$#f($#i2$%r%$#t$$#i%$&9A )I$ 2I# V\",\" ~l7$#'$ 4'&s% zg%$(`8$#k5$!o\/p7 #]&$#]($#f)$#i5$-i$$#u$$!9A 'I& 2I# V\",\" )'! #'# sl6$% 4'%$!s% yg%$'v!$$`6$!k6$!o\/ !p5$#w! !]$$$]'$#f+$!i8$&i($!u%$!9@ !x! &I% $I# .I# V\",\" ,'$ #'# ol9 5'$$!s' wg%$!v)$#`5$#k5$!o\/ !p5$#w!y#$&]'$!f,$#i9$(i#$#u$$#9?$!x# $I# (I! .I# W\",\" 1'# ol8 4''s' wg$$#v($&`4$#k4$!o0 !p5$#y&$# %]#$!f& !f'$#i8$#z!$%i#$!u$$#9?$!x$I& (I! .I# W\",\" 4'# ll8 4'% $s( tg$$$v($!{$$#`4$#k3$!o1p6$!y%$#|$ -f#$&i8$#z#$'u$$$9=$!x%I& (I! .I# 1I# E\",\" 4'% #'! il6 4}' !s) rg%$!~!$!v($!{%$$`3$$k$$#k,$!o\/$!o! !p5$#y$$#|& +f!$#i<$#z#$&u%$!u!$!9)$#92 !x& !I# q\",\" :'# il5 2}, !s& rg$$%v($#{&$#`0$$!$)k*$!o.$#\u0080! #p5$&|( ,i>$!z#$%u($#9$$(91 !x& t\",\" <'$ gl4 2}- $s#\u0081$ ng%$$v*$!{'$#`.$#'$!\u0082$$$k($0\u0080$ !p9$#|' ,i>$!z%$#u)$#9!$%\u0083$$#9)$#9$ %x% t\",\" <'( gl1 )l' #}\/ #s!$!\u0081$ m$(v*$!{($$`*$$($!\u0082&$$k&$!\u00803 !p8$#|' ,i>$!z%$!u+$&\u0083&$#9+ (x#$! t\",\" ?'& gl0 )l' (}+$!s#\u0081$ m$!v0$!{*$#`($#*$#\u0082'$$k$$!\u00803 !p8$!|' .i> $z!$!u+$$\u0084!$$\u0083%$!9' -\u0085# t\",\" A'% gl0 (l' +})$!\u0086!$!\u0087# m$!v0$!{+$#`&$#,$!\u0082)$#k!$#\u00803 !p8$!|' \/i$ !i7 '$!u)$%\u0084%$#\u0083% !9& -\u0085$ 3I! ,\u0088# R\",\" B'% fl0 'l' (\u0089% !}($!\u0086!$#\u0087$ lv0$!{,$#`#$$-$!\u0082*$$\u00804 #p4$%|% 5i6 (u)$#\u008a!$$\u0084#$$\u0083# #9& .\u0085$ @\u0088! >$# 3\",\" B'$ hl1 !l* (\u0089$ #\u008b!$!\u008b! #\u0086%$#\u0087% !'$ !\u008c! ev0$!{-$%\/$!\u0082,$!\u00805 !p\/$'|( 5i4 +u'$#\u008a$$#\u0084#$$\u0083# #9% .\u0085% A\u0088! =$# 3\",\" \u008dl7$$ -\u008b% !\u0086%$#\u0087%$) cv0$!{\/$!0$!\u0082,$!\u00804$# !p,$$\u008d$$!|( 6i3 ,u'$#\u008a$$)\u0083! #9% -\u0085& A\u0088! Q\",\" \u008el3$%\u008e# -\u008b% #\u0086# !$!\u0087# %$)\u008f! S\u0090# ,v0$!{\/$!0$!\u0082,$!\u00803$#\u0091! !p%$%p#$#\u008d&$#|& 7i2 .u&$#\u008a$$%\u008a!$$\u0083# #9! \/\u0085& A\u0088! Q\",\" \/$# \u0081l\/$$\u0092!$!\u008e# C$#\u008f! S\u0090& )v#$#v,$#{-$#\/$#\u0082,$!\u00802$#\u0091%p$$!\u008d#$%\u008d($!|$ 9i1 \/u'$#\u008a($%\u0083# 1\u0085& A\u0088! Q\",\" \/$# \u0083l-$$\u0092!$#\u0093' ?\u0094!\u0095#\u0096% O\u0090& ($&v,$!{-$!\/$#\u0082-$!\u00802$!\u0091&$%\u008d.$!|! ;i0 0u($!\u008a($#\u0084!$#\u0083# 0\u0085& A\u0088! Q\",\" \u0096l)$#\u0092$$#\u0093( >\u0096!$!\u0096% Q\u0090% '\u0097&$#v!$+{)$&.$#\u0082,$$\u00801$#\u0091'$!\u008d0 >i- 2u% !u!$#\u008a)$#\u0084!$#\u0083# \/\u0085& A\u0088! Q\",\" \u009dl!$#\u0092$$!\u0093&$$ =\u0096#$# S\u0090% '\u0097($%{-$&2$!\u0082,$#\u00803$!\u0091!$$\u0091$$!\u008d\/ ?i, 2u# %u!$#\u008a)$#\u0084!$#\u0083# ,9! #\u0085' ?\u0088# @\u0098# 0\",\" \u009e$!\u0092#$%\u0093#$$\u0099$ <\u0096#$# S\u0090! *\u0097)$!{-$$\u009a#$!3$!\u0082,$#\u00803$+\u008d+ Ci+ 2u# %u#$!\u008a&$(\u0083$ \/\u0085) =\u0088! A\u0098# 0\",\" \u009f\u0092#$!\u009b#$&\u0099$ !\u009c# <$#\u009d# ]$'\u0097!$#{*$$\u009a%$#$$(#$'\u0082,$!\u00804$!\u009e'$%\u008d) Di+ 1i!$#i! %u!$#\u008a$$#\u009f$$!\u009f!$#\u0083# \/\u0085) <\u00a0# R\",\" \u00a3\u009b#$#\u0099& !\u009c# -\u009c# !$# +$!\u00a1!\u009d# ]$(\u0097!$!{*$$\u009a&$$!$!\u00a2$$'\u00a2!$#\u00a2!$$\u0082*$!\u00803$#\u009e($$\u008d& Di! #i+ 1i% %u!$#\u008a$$#\u009f&$#\u0083# \/\u0085* ;\u00a0! S\",\" \u00a5\u0099)\u009c# ,\u009c#$' (\u00a3!$!\u00a1! _\u0097!$$\u00a4!$){%$#\u009a)$%\u00a2\/$#\u0082*$#\u0080-$$\u0080!$#\u009e)$%\u008d# '\u00a5$ <i$ #i* 0i% %u$$!\u008a%$!\u009f%$$\u0083# .\u0085+ T\u0098! $\u0098# &\u0098# .\",\" \u00a6\u0099#$!\u0099$ ,\u009c%$#\u00a6#$$ %\u00a6# !\u00a3#\u00a7# _\u00a4#$$\u00a8'$#{$$!\u009a)$&\u00a2.$$\u0082+$!\u0080-$$\u0080!$!\u009e*$!\u00a9!$!\u00a5! $\u00a5) <i\/ 0i$ &u$$!\u008a! #\u008a!$!\u009f$$#\u0083% .\u0085, S\u0098# #\u0098& !\u0098# \/\",\" \u0086\u00aa# @$& +\u009c%$#\u00a6.$#\u00a7# _\u00a4#$!\u00a8)$#{!$$\u009a#$(\u00ab$$!\u00a2.$!\u00ac!$!\u0082)$%\u0080,$&\u009e*$$\u00a5- <i& !i) 0i$ 'u!$# %\u009f#$%\u0083% -\u0085- S\u0098# %\u0098$ !\u0098% -\",\" \u0086\u00aa# @\u00ad' $\u00ae$ #\u009c&$!\u00a6\/$#\u00a7! b\u00a8%$$\u00a8$$*\u00af$$#\u00ab#$#\u00a2-$&\u0082($!\u00b0#$&\u0080!$(\u00b1!$#\u009e,$#\u00a5- =i% !i'$!\u00b2! 1i! ($#\u008a# $\u009f!$#\u0083& .\u0085. 1\u00b3! !\u00b3$ <\u0098# &\u0098# $\u0098% -\",\" \u00a8\u00ad%$!\u00ae(\u009c&$#\u00a62 c\u00a8#$#\u00b4!$!\u00a8$$!\u00b5%$%\u00af$$$\u00ab!$!\u00a2.$$\u0082($$\u00b0#$$\u00b1!$)\u00b1$$!\u009e-$#\u00a5+ >i$ $i%$#\u00b2# 0i# &\u008a!$!\u008a$ %\u0083& \/\u0085\/ 1\u00b3! !\u00b3$ -\u00b3! \/\u0098# &\u0098% !\u0098% -\",\" \u00aa\u00ad#$!\u00ae'$#\u009c&$!\u00a62$!\u00b6! b$#\u00b4#$$\u00a8!$#\u00b5'$!\u00af$$!\u00b7!$$\u00a2-$#\u00ac!$#\u0082%$$\u00b0%$#\u00b1-$#\u009e.$%\u00a5( ?i# $i%$!\u00b2% \/i$ %\u008a' %\u0083$ 0\u00850 \/\u00b3! *\u00b3! '\u00b3& 3\u0098% #\u0098$ -\",\" \u00aa\u00ad!$#\u00ae'$#\u009c&$#\u00a60$#\u00b6# a\u00b4%$$\u00a8!$#\u00b5&$#\u00af$$%\u00a2.$!\u00ac$$'\u00b0($#\u00b1+$$\u009e1$%\u00a5$ @i# $i% !\u00b2% \/i$ %\u008a' %\u0083# 0\u00851 +\u00b8! $\u00b3! $\u00b3! &\u00b3! !\u00b3% !\u00b3& #\u00b3$ 1\u0098$ !\u0098# -\",\" \u00ac\u00ae& !$#\u009c'$%\u00a6.$#\u00b6$ a\u00b4#$#\u00b9!$$\u00b5'$!\u00af%$!\u00b7!$#\u00a2+$%\u00ac$$%\u00b0+$#\u00b1+$#\u009e2$#\u00a5% @\u00ba# )\u00b2% 0i# &\u008a' 5\u00bb!$#\u0085. *\u00b8# -\u00b3# !\u00b3$ !\u00b3# #\u00b3$ #\u00b3# #\u00b3# -\u0098$ !\u0098$ ,\",\" \u00b3\u009c)$&\u00a6!$!\u00a6)$$\u00b6% a\u00b4!$!\u00b9$$#\u00b5'$!\u00af%$%\u00a2*$%\u00ac%$!\u00b0\/$#\u00b1+$#\u009e0$#\u00a5% A\u00ba# )\u00b2% 0i#\u00bc% #\u008a!$$\u008a!$! 3\u00bb#$#\u0085. *\u00b8# ,\u00b3! )\u00b3! #\u00b3$ '\u00b3& ,\u0098# !\u0098# ,\",\" :$! \u0099\u009c-$%\u00a6($#\u00b6%$!\u00bd%$!\u00be! Z\u00b9'$#\u00b5&$#\u00af%$$\u00a2)$#\u00ac'$#\u00b00$#\u00b1+$!\u009e\/$#\u00a5& A\u00ba# )\u00b2% 1\u00bc'$$\u00bb!$$\u00bb# #\u00bc' )\u00bb$$$\u0085+ F\u00b3$ $\u00b3# $\u00b3! *\u0098% !\u0098$ +\",\" \u00b3\u009c\/$!\u00a6*$#\u00b6#$#\u00bd$$#\u00be$ W\u00b9)$!\u00b5&$#\u00af& &\u00a2&$!\u00ac($!\u00b0'$#\u00b0&$'\u00b1*$$\u009e+$$\u00a5& B\u00ba$ <\u00bc'$#\u00bb( !\u00bc( ($!\u00bb&$!\u0085% $\u0085$ (\u00b8# =\u00b3$ $\u00b3! (\u00b3# &\u0098% \/\",\" <\u00bf# \u0090\u009c# %\u009c\/$!\u00a6$$#\u00a6$$%\u00b6!$!\u00bd%$!\u00be$$!\u00c0! U\u00b9*$!\u00b5$ #$!\u00af$ )\u00a2%$#\u00ac($#\u00b0%$+\u00c1$$%\u00b1&$&\u009e%$#\u009e!$$\u00a5' C\u00ba$ <\u00bc($#\u00bb' !\u00bc) %\u00bb!$+\u00bc+ &\u00b8# S\u0098# 0\",\" >\u00bf! \u008f\u009c# %\u009c\/$#\u00a6#$'\u00c0!$#\u00b6!$#\u00bd$$#\u00be!$#\u00c0! U\u00b9*$! 3\u00a2$\u00c2!$!\u00ac)$!\u00b0!$%\u00c1%$#\u00c1*$)\u00c3#$*\u00a5) C\u00ba$ <\u00bc)$#\u00bb& !\u00bc) $\u00bb#$$\u00bc#$#\u00bc0 E\u00b3! 9\u00bf# *\",\" \u00b2\u009c0$#\u00a6$$!\u00c0&$!\u00b6#$#\u00bd$$#\u00be!$!\u00c0# V\u00b9* 6\u00c2#\u00ac)$$\u00c4!$#\u00c11$$\u00c5#$#\u00c3&$#\u00c3!$#\u00a5) D\u00ba$ <\u00bc*$#\u00bb&\u00bc)\u00bb'$#\u00bc5 !\u00b8# Z\u00bf# *\",\" @\u00bf# }\u00c6# 2\u009c1$#\u00a6$$#\u00c0%$#\u00b6#$)\u00c0$ V\u00b9) 8$,\u00c4!$#\u00c11$#\u00c5%$!\u00c3)$!\u00a5) E\u00ba# =\u00bc+$$\u00bb$\u00bc)\u00bb'$!\u00bc8$! Z\u00bf# *\",\" @\u00bf# }\u00c6% 0$!\u009c-$&\u00a6$$#\u00c0&$'\u00c0* V\u00b9( 5\u00c7! #\u00c2$$!\u00c8!$&\u00c4#$!\u00c12$#\u00c5%$!\u00c3)$!\u00a5( F\u00ba# ?\u00bc+$%\u00bc'$#\u00bb#$&\u00bc; X\u00bf# *\",\" %$# \u0098\u00c6& -\u00c6#$$\u009c+$#\u00c0#$&\u00c0'$#\u00c0\/ ;\u00c0# <\u00b9% 5\u00c7! !\u00c2!$%\u00c8!$$\u00c4%$!\u00c11$#\u00c5%$#\u00c3)$!\u00a5& H\u00ba# @\u00bc+$$\u00bc($'\u00bc@ ;\u00b3# 9\u00bf# *\",\" %$# \u0098\u00c6' ,\u00c6%$%\u009c($#\u00c0%$!\u00c0: n\u00c7# $\u00c8'$#\u00c4%$!\u00c11$!\u00c5&$!\u00c3*$!\u00a5% I\u00ba# A\u00bc[ 3\u00c9$ >\u00bf$ )\",\" %$# 7$! \u0081\u00c6( +\u00c6($$\u009c&$#\u00c0B k\u00c7# #\u00c8($#\u00c4$$#\u00c11$!\u00c5&$!\u00c3*$!\u00a5$ J\u00ba# B\u00bc^ -\u00c9( 5\u00ca! #\u00bf# %\u00bf$ (\",\" \u009e\u00c6( *\u00c6)$%\u009c%$#\u00c0D h\u00c2# $\u00c8)$!\u00c4#$#\u00c12$)\u00c3)$!\u00a5# K\u00ba# B\u00bc` %\u00c9\/ 4\u00ca! #\u00bf# &\u00bf& %\",\" \u009f\u00c6& +\u00c6($#\u00cb#$#\u009c%$!\u00c0F f\u00c2# $\u00c8&$%\u00c4#$!\u00c12$$\u00cc&$$\u00c3'$# q\u00bc_$!\u00c92 ?\u00bf% %\",\" ,\u00bf# \u00a1\u00c6'$#\u00cb$$(\u00c0K g\u00c8$$&\u00c4#$!\u00c12$$\u00cc($$\u00c3' q\u00bc_$!\u00c93 ?\u00bf$ %\",\" )\u00bf! #\u00bf# \u009c\u00cb'$!\u00c6#$$\u00cb)$#\u00c0N e\u00c8$$#\u00c4%$#\u00c12$$\u00cc*$!\u00c3% 5\u00cd! _\u00bc^$!\u00c94 @\u00bf! %\",\" )\u00bf! #\u00bf$ 6\u00bf! \u0085\u00cb'$#\u00c6!$!\u00cb+$#\u00c0O %\u00c0% ]\u00c8!$#\u00c4&$!\u00c13$$\u00cc*$#\u00c3$ 5\u00cd# _\u00bc]$!\u00c95 D\",\" (\u00bf# !\u00bf$ 7\u00bf! \u0085\u00cb'$%\u00cb($&\u00c0R c\u00c4#$'\u00c13$#\u00cc,$$\u00c3! 2\u00cd! #\u00cd# `\u00bc[$!\u00c95 D\",\" B\u00bf# \u0086\u00cb)$!\u00cb)$!\u00c0W c$&\u00c15$#\u00cc0 2\u00cd# !\u00cd# 6\u00ce$ H\u00bcZ$!\u00c96 C\",\" B\u00bf# \u0086\u00cb1$#\u00c0W d$(\u00c12$#\u00cc\/ 3\u00cd# 9\u00ce# J\u00bcY$!\u00c96$! @\u00cf! !\",\" \u00a9\u00cb1$#\u00c0W d\u00d0'$#\u00c1#$$\u00c1-$!\u00cc\/ 2\u00cd# $\u00cd# 5\u00ce! L\u00bcX$!\u00c95$#\u00d1% 9\u00cf&\",\" \u00aa\u00cb\/$#\u00c0X e\u00d0'$!\u00c1#$!\u00d0!$$\u00c1+$#\u00cc. 2\u00cd# $\u00cd# 6\u00ce# K\u00bcW$!\u00c94$#\u00d1* 5\u00cf&\",\" X\u00aa# q\u00cb0$!\u00c0X =\u00d2! G\u00d0'$%\u00d0#$#\u00c1+$#\u00cc. |\u00bc@$%\u00bc3$!\u00c94 !\u00d1\/ 1\u00cf&\",\" +\u00d3# M\u00aa# p\u00cb0$#\u00c0W e\u00d0.$!\u00c1)$'\u00cc, 0\u00cd! m\u00bc>$&\u00bc3$!\u00c94 !\u00d14 ,\u00cf&\",\" ,\u00d3# >\u00bf! .\u00aa! !\u00aa! p\u00cb\/$$\u00c0!$!\u00c0&$$\u00c0L e\u00d0-$#\u00c1)$!\u00d4%$%\u00cc) )\u00cd% $\u00cd! p\u00bc:$%\u00bc5$'\u00c9\/ $\u00d14 +\u00cf%\",\" K\u00bf! 0\u00aa! q\u00cb0$$\u00c0$$&\u00c0K f\u00d0.$!\u00c1)$!\u00d4'$$\u00cc($! (\u00cd% $\u00cd# '\u00cd! f$# $\u00bcA +\u00bc# #\u00d5&$!\u00c9. '\u00d12 +\u00cf%\",\" [\u00aa! r\u00cb1$&\u00d6#$#\u00c0J h\u00d0-$%\u00c1&$!\u00d4'$!\u00d7!$!\u00cc&$$\u00d8! #\u00d9! 3\u00cd! f$# '\u00bc8 &\u00d5& %\u00d5! '\u00d5$ #\u00c90 &\u00d12 +\u00cf$\",\" H\u00bf# \u0085\u00cb2$!\u00d6&$!\u00c0I i\u00d0-$!\u00d0#$$\u00c1!$!\u00c1!$!\u00d4'$!\u00d7!$(\u00d8# $\u00d9# %\u00da! #\u00db! d$# 6\u00bc2 (\u00d5, '\u00d5% #\u00c9. '\u00d12 ,\u00cf#\",\" \u00ae\u00cb2$#\u00d6%$$\u00c0F i\u00d01$!\u00d4!$(\u00d4%$$\u00d8) $\u00d9#$!\u00dc! %\u00db# d$# :\u00bc* !\u00d5$ (\u00d5- &\u00d5% #\u00c9. (\u00d1% !\u00d1+ *\u00dd# $\",\" &\u00de! \u00a8\u00cb3$!\u00d6'$$\u00c0D h\u00d0\/$%\u00d4&$$\u00d4$$#\u00d7!$!\u00d8) $\u00d9#$!\u00dc! $\u00db% \u0089\u00d5# (\u00d5, '\u00d5% >\u00df#$&\u00d1! *\u00dd# $\",\" &\u00de! &\u00e0! K\u00aa# w\u00cb1$#\u00d6)$%\u00c0@ i\u00d0\/$!\u00d4*$#\u00d4$$#\u00d7!$#\u00d8( &\u00dc# #\u00db& \u008c\u00d5% !\u00d5. %\u00d5' =\u00df) \/\",\" #\u00de! )\u00e0!$!\u00e1! B\u00aa% $\u00aa# #\u00aa! u\u00cb0$#\u00d6+$#\u00c0? j\u00d0\/$!\u00d4-$(\u00d8) )\u00db& \u008b\u00d54 %\u00d5) ;\u00df) \/\",\" &\u00e2$ E\u00aa( (\u00aa! u\u00cb0$!\u00d6,$#\u00c0? i\u00d00$!\u00d4+$$\u00d8#$!\u00d8!$$\u00d8( (\u00db' \u008a\u00d54 '\u00d5( ;\u00df) \/\",\"\u00dd# $\u00e2& ;\u00aa! (\u00aa( #\u00aa& v\u00cb0$!\u00d6-$!\u00c0@ N\u00d2! 9\u00d00$!\u00d4*$$\u00d8%$%\u00d8( %\u00db* \u0089\u00d56 %\u00d5) <\u00df) -\u00dd!\",\"\u00dd# $\u00e2& :\u00aa# #\u00aa# $\u00aa# !\u00aa, w\u00cb\/$#\u00d6,$%\u00c0< O\u00d2! 9\u00d00$!\u00d4)$#\u00e3!$%\u00d8!$$\u00d8( %\u00db+ \u0088\u00d5C <\u00df) *\u00dd%\",\"\u00dd$ #\u00e2& ;\u00aa# #\u00aa# !\u00aa! %\u00aa) #\u00aa# v\u00cb-$#\u00d6\/$#\u00c0< i$%\u00d0,$#\u00d4'$#\u00e3&$!\u00d8#$#\u00d8' $\u00da! !\u00db* \u0088\u00d5E ;\u00df) )\u00dd&\",\"\u00dd$ $\u00e2% @\u00aa$ !\u00aa! #\u00aa* !\u00aa# w\u00cb,$#\u00d60$#\u00c0< h\u00e4$$6\u00e3'$!\u00d8) (\u00db* \u0088\u00d5F ;\u00df( )\u00dd&\",\"\u00dd$ #\u00e2& K\u00aa( !\u00aa$ t\u00cb+$$\u00d60$#\u00c0< h\u00e4.$+\u00e3($#\u00d8& *\u00db* \u0087\u00d5H 6\u00e5# #\u00df) (\u00dd&\",\"\u00dd$ #\u00e2& %\u00e6! G\u00aa( !\u00aa# ~\u00e7#$#\u00d6,$!\u00d6#$!\u00c0; j\u00e4.$!\u00e8'$#\u00e3)$!\u00d8' *\u00db* \u0087\u00d5H 4\u00e5($!\u00df' )\u00dd%\",\" !\u00dd# #\u00e2& H\u00aa# $\u00aa' \u0081\u00e7$$!\u00d6)$(\u00c0; k\u00e4-$!\u00e8($#\u00e3($#\u00d8$ ,\u00db) ,\u00e9# '\u00e9# o\u00d5N 2\u00e5($#\u00df& )\u00dd# !\u00dd!\",\" !\u00dd# !\u00e2' H\u00aa% %\u00aa$ \u0081\u00e7$$!\u00d6)$!\u00ea&$!\u00c0; .\u00c0$ [\u00e4,$!\u00e8)$#\u00e3'$!\u00d8$ -\u00db) ,\u00e9# (\u00e9! j\u00d5T 2\u00e5($#\u00df% -\",\" !\u00dd# !\u00e2& 4\u00eb! 7\u00aa# %\u00aa$ !\u00aa$ }\u00e7$$#\u00d6($!\u00ea&$!\u00c0: 0\u00c0# [\u00e4,$!\u00e8*$!\u00e3'$!\u00d8% +\u00db* )\u00ec# !\u00e9# r\u00d5T #\u00d5# .\u00e5)$#\u00df# .\",\" #\u00e2( ;\u00aa! 4\u00aa% #\u00aa$ }\u00e7%$!\u00d6!$#\u00d6%$!\u00ea&$!\u00c0: n\u00e4+$!\u00e8*$$\u00e3$$#\u00d8% &\u00da! %\u00db) *\u00ec# s\u00d5W !\u00d5% -\u00e5* 0\",\" !\u00e2( A\u00aa! 1\u00aa$ !\u00aa# ~\u00e7%$*\u00ea&$%\u00c07 n\u00e4*$#\u00e8+$'\u00d8& '\u00da! $\u00db) ~\u00d5W !\u00d5$ \/\u00e5) 0\",\"\u00e2( @\u00aa! 6\u00aa# !\u00aa$ {\u00e7%$#\u00ed$$!\u00ed#$#\u00ea($#\u00c04 q\u00e4)$!\u00e8+$#\u00ee$$!\u00d8' '\u00da! $\u00db) ~\u00d5Y $\u00d5# -\u00e5( 0\",\"\u00e2' F\u00aa! !\u00aa# .\u00aa# !\u00aa$ {\u00e7&$!\u00ed($#\u00ea'$$\u00c02 r\u00e4)$!\u00e8*$#\u00ee%$#\u00d8& +\u00db( \u00d5Y $\u00d5# \/\u00e5% 1\",\"\u00e2& I\u00aa# \u008e\u00e7$$$\u00ed)$$\u00ea&$#\u00c0\/ u\u00e4)$!\u00e8)$#\u00ee'$!\u00d8& +\u00db( ~\u00d5] F\",\"\u00e2$ e\u00ef! v\u00e7$$!\u00ed-$$\u00ea%$!\u00c0- w\u00e4)$#\u00e8'$#\u00ee($!\u00d8& ,\u00db' ~\u00d5] F\",\" \u00bd\u00e7$$!\u00ed\/$#\u00ea$$#\u00c0* y\u00e4)$#\u00e8#$&\u00ee($#\u00d8$ .\u00db& \u00d5] F\",\" \u00af\u00e7# -\u00e7$$!\u00ed\/$!\u00ea%$#\u00c0) z\u00e4)$#\u00e8!$#\u00ee!$#\u00ee($$\u00d8# \u0092\u00d5] F\",\" \u0086\u00e7! I\u00e7# ,\u00e7%$!\u00ed.$#\u00ea$$$\u00c0) {\u00e4($%\u00ee,$& \u0092\u00d5] F\",\" S\u00aa! R\u00e7! V\u00e7$$#\u00ed.$)\u00c0) {\u00e4($!\u00ee0$#\u00ee# \u0093\u00d5[ F\",\" \u00bc\u00e7$$!\u00ed3$#\u00c0+ {\u00e4#$#\u00e4$$!\u00ee3 \u0094\u00d5[ F\",\" \u00bb\u00e7$$#\u00ed2$#\u00c0, |\u00e4!$'\u00ee+$$\u00ee& \u0094\u00d5[ 4$# 1\",\" #\u00f0# \u00b7\u00e7$$!\u00ed3$!\u00c0, ~\u00ee%$!\u00ee+$#\u00f1!$!\u00ee% \u0095\u00d5[ 4$# 1\",\" !\u00f0# \u00b8\u00e7$$!\u00ed2$#\u00c0+ \u00ee0$!\u00f1!$#\u00ee$ \u0098\u00d5Y F\",\" !\u00f0# \u00b8\u00e7$$!\u00ed1$%\u00c0) \u0081\u00ee\/$$\u00ee% \u0098\u00d5Y F\",\" !\u00f0! \u00b9\u00e7#$#\u00ed1$!\u00f2#$#\u00c0( \u0081\u00ee5 \u0099\u00d5Y '\u00d5# >\",\" !\u00f0! \u00b9\u00e7#$#\u00ed1$!\u00f2$$$\u00c0% \u0083\u00ee4 \u0099\u00d5X (\u00d5# >\",\" \u00bb\u00e7#$#\u00ed1$!\u00f2&$!\u00c0$ \u0084\u00ee2 \u009b\u00d56 $\u00d5@ )\u00d5! >\",\" \u00bb\u00e7$$!\u00ed0$#\u00f2&$#\u00c0! \u0085\u00ee2 \u009c\u00d51 *\u00d5> G\",\" \u00ae\u00e7# !\u00e7# )\u00e7$$!\u00ed0$!\u00f2'$#\u00c0! \u0085\u00ee0 \u009d\u00d50 -\u00d5< H\",\" \u00ae\u00e7# !\u00e7# )\u00e7$$!\u00ed0$#\u00f2'$! \u0086\u00ee\/ \u009e\u00d5\/ .\u00d5; >\u00f0# *\",\" \u00ba\u00e7%$!\u00ed1$#\u00f2' \u0086\u00ee- \u00a0\u00d5) #\u00d5% \/\u00d5: >\u00f0$ )\",\" \u00ba\u00e7$$#\u00ed2$$\u00f2# \u008a\u00ee$ \u00a8\u00d5& 7\u00d59 ?\u00f0% (\",\" \u00ba\u00e7$$#\u00ed4$!\u00f2! \u0131\u00d57 @\u00f0% '\",\" \u00b9\u00e7$$#\u00ed5 \u0133\u00d57 @\u00f0& &\",\" \u00b8\u00e7%$#\u00ed5 `\u00d2! \u00f9\u00d51 B\u00f0% &\",\" \u00b8\u00e7%$!\u00ed6 _\u00d2# \u00f9\u00d51 B\u00f0) !\",\" \u00b8\u00e7%$#\u00ed4 \u013a\u00d50 C\u00f0( !\",\" \u00b8\u00e7%$#\u00ed3 \u013c\u00d5, E\u00f0) !\",\" \u00b9\u00e7$$!\u00ed2 \u0141\u00d5# !\u00d5% E\u00f0) #\",\" \u00b8\u00e7%$!\u00ed. \u0146\u00d5# !\u00d5& C\u00f0) #\",\" \u00b8\u00e7$$#\u00ed. k\u00d2! \u00fc\u00d5$ #\u00d5$ B\u00f0) $\",\" \u00b8\u00e7$$!\u00ed\/ \u0146\u00d5) A\u00f0) %\",\" \u00b8\u00e7$$!\u00ed\/ \u0147\u00d5( A\u00f0( &\",\" \u00b8\u00e7$$!\u00ed+ \u014b\u00d5( @\u00f0) &\",\" \u00b8\u00e7$$!\u00ed- \u014a\u00d5' ?\u00f0' )\",\" \u00b7\u00e7%$!\u00ed- \u014a\u00d5' >\u00f0( )\",\" %\u00f0# \u00b1\u00e7%$!\u00ed, \u014b\u00d5& >\u00f0( *\",\" $\u00f0% \u00b0\u00e7%$#\u00ed* \u014d\u00d5% <\u00f0* *\",\" %\u00f0$ \u00af\u00e7&$#\u00ed* \u016b\u00f0+ *\",\" \u00b6\u00e7&$#\u00ed* \u016b\u00f0( -\",\" \u00b6\u00e7&$#\u00ed) \u016b\u00f0) -\",\" \u00b6\u00e7&$#\u00ed' \u00c7\u00da$ \u00c5\u00f0) -\",\" \u00b6\u00e7&$#\u00ed' \u00b6\u00ee# 0\u00da& \u00c3\u00f0( .\",\" \u00b5\u00e7'$#\u00ed( \u00b5\u00ee# 1\u00da% \u00c3\u00f0' \/\",\" \u00b6\u00e7&$!\u00ed* \u00b4\u00ee# \u00d8\u00f0$ 1\",\" \u00b6\u00e7%$#\u00ed* \u017f\",\" \u00b6\u00e7%$#\u00ed* \u00e0\u00da# \u00bf\",\" \u00b5\u00e7&$#\u00ed) \u00e1\u00da% \u00bd\",\" \u00b5\u00e7&$!\u00ed) \u00e2\u00da% \u00bd\",\" \u00b5\u00e7%$!\u00ed) \u00e3\u00da% \u00bd\",\" \u00b6\u00e7$$!\u00ed) \u00e3\u00da% \u00a9\u00f0! 4\",\" \u00b6\u00e7$$$\u00ed& \u016e\u00f0# 4\",\" \u00b6\u00e7$$$\u00ed% +\u00f3' \u015f\u00f0# 4\",\" \u00b6\u00e7%$#\u00ed% +\u00f3( \u0173\",\" \u00b6\u00e7&$%\u00ed# *\u00f3( \u0173\",\" \u00b6\u00e7)$$ *\u00f3' \u0163\u00f0$ \/\",\" \u00b6\u00e7+$!\u00ed! +\u00f3$ \u00db$% \u00a7\u00f0$ \/\",\" \u00b7\u00e7*$!\u00ed# +\u00f3# \u00db$% \u00b8\",\" \u00b7\u00e7*$!\u00ed$ C\u00f4! \u00c5$# \u00b8\",\" \u00b8\u00e7)$!\u00ed% G\u00f4$ \u0138\u00d5! >\",\" \u00b9\u00e7($!\u00ed' F\u00f4$ X\u00f5# \u00fd\u00d5# >\",\" \u00b9\u00e7($$\u00ed& G\u00f4# W\u00f5# \u00fd\u00d5# >\",\" \u00bb\u00e7($$\u00ed$ I\u00f4! \u0134\u00d5# >\",\" \u00bd\u00e7( \u0180\",\" \u00be\u00e7' \u0180\",\" \u00bf\u00e7# !\u00e7! X\u00f4! \u0149\",\" \u00bf\u00e7# [\u00f4! \u0148\",\" \u00fb\u00f4# \u0147\",\" \",\" \u00fc\u00f4! \u0147\",\"357\",\"357\",\"357\",\" \u00fb\u00f4! \u0148\",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \",\" \"]}";

