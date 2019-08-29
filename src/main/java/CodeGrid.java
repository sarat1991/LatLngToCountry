public class CodeGrid {

/*

  CodeGrid(){


  }

}

class Zoomgrids{

  Object zoomgrids;
  Object[] zGrids;
  Object zoom;
  Object nextZoomgrids;

  Zoomgrids(Object[] zlist){

    this.zoom = zlist[0];
    if (zlist.length > 1) {
      nextZoomgrids = Zoomgrids (zlist[1]);
    }


  }


    getCode(double lat, double lng){
      double x = long2tile (lng, zoom),
          y = lat2tile (lat, zoom);
    }

  loadWorldJSON (json) {
    worldAttr = json.data;
    worldGrid = Grid(0,0,0,json);
    if (worldGrid !== null) initialized = true;
    initializing = false;
  }

  double long2tile (double lon,double zoom) {
    // http://javascript.about.com/od/problemsolving/a/modulobug.htm
    return (Math.floor((((((lon+180)/360)%1)+1)%1)*Math.pow(2,zoom)));
  }

  double  latlimit =  Math.atan((Math.exp(Math.PI) - Math.exp(-Math.PI))/2) / Math.PI * 180;

  double lat2tile (double lat,double zoom) {
    if (Math.abs(lat)>= latlimit) return -1;
    return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) +
        1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom)));
  }*/
}

