import java.io.FileReader;
import java.util.HashMap;
import javax.script.Invocable;
import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import jdk.nashorn.api.scripting.ScriptObjectMirror;
import lombok.extern.slf4j.Slf4j;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;

@Slf4j
public class GeoLocation {

  public final static GeoLocation INSTANCE = new GeoLocation();
  private Invocable invocable;
  private HashMap<String, String> countriesMap = new HashMap<>();

  private GeoLocation(){
    initialize();
  }

  void initialize(){
    try {
      ScriptEngine engine = new ScriptEngineManager().getEngineByName("nashorn");
      FileReader fr = new FileReader(".//src//main//resources//node_module//CountryCodeGrid.js");
      engine.eval(fr);
      this.invocable = (Invocable) engine;
      JSONParser jsonParser = new JSONParser();
      fr = new FileReader(".//src//main//resources//countries.json");
      Object obj = jsonParser.parse(fr);
      JSONArray countriesList = (JSONArray) obj;
      for(int i = 0; i<countriesList.size(); i++){
        countriesMap.put(((JSONObject)countriesList.get(i)).get("alpha-2").toString().toLowerCase(),
            ((JSONObject)countriesList.get(i)).get("name").toString());
      }
      } catch (Exception e){
        log.warn("Exception while parsing the file due to {}",e.getCause().getMessage());
    }
  }

  public String getCountry(double latitude, double longitude) {
    String countryCode = null;
    try {
      Object result = invocable.invokeFunction("CodeGrid");
      System.out.println("Initialization is done");
      Object response = ((ScriptObjectMirror) result)
          .callMember("getLatLongCode", latitude, longitude);
      countryCode = countriesMap.get(response.toString());
    }catch (Exception e){
      log.warn("Exception while retrieving country code for lat  {} and long {}. Cause: {} ",latitude,longitude,e.getCause().getMessage() );
    } finally {
      return countryCode;
    }

  }
}
