import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.util.HashMap;
import javax.script.Invocable;
import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import jdk.nashorn.api.scripting.JSObject;
import jdk.nashorn.api.scripting.ScriptObjectMirror;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;

public class test {

  public static void main(String[] args) {

    try {
      ScriptEngine engine = new ScriptEngineManager().getEngineByName("nashorn");
      //load('.//src//main//java//jvm-npm.js');
      engine.eval(new FileReader(".//src//main//java//world.js"));

      JSONParser jsonParser = new JSONParser();
      HashMap<String, String> countriesMap = new HashMap<>();
      try (FileReader reader = new FileReader(".//src//main//resources//countries.json"))
      {
        //Read JSON file
        Object obj = jsonParser.parse(reader);

        JSONArray countriesList = (JSONArray) obj;

        for(int i = 0; i<countriesList.size(); i++){
          countriesMap.put(((JSONObject)countriesList.get(i)).get("alpha-2").toString().toLowerCase(),
              ((JSONObject)countriesList.get(i)).get("name").toString());
        }
        //System.out.println(countriesMap);

      } catch (FileNotFoundException e) {
        e.printStackTrace();
      } catch (IOException e) {
        e.printStackTrace();
      }

     /* NashornScriptEngine engine = (NashornScriptEngine) new ScriptEngineManager().getEngineByName("nashorn");

      FilesystemFolder rootFolder = FilesystemFolder.create(new File(".//src//world.js"), "UTF-8");
      Require.enable(engine, rootFolder);*/
      //JSObject object = (JSObject) context.getAttribute(name, ScriptContext.ENGINE_SCOPE);


      Invocable invocable = (Invocable) engine;


      Object result = invocable.invokeFunction("CodeGrid");
      System.out.println("Initialization is done");
      //17.3850,78.4867 -- Hyderabad
      //23.8927, 91.2438 -- Agartala Airport
      //4.2105, 101.9758 -- malaysia
      //1.421653, 103.935075 -- Singapore
      Object response = ((ScriptObjectMirror) result).callMember("getLatLongCode",1.421653, 103.935075);
      JSObject callBackFunc = (JSObject) engine.eval("function testCbk(error, res) {return res;}");
      //Object response = ((ScriptObjectMirror) result).callMember("getCode",17.3850,78.4867 , callBackFunc);
      System.out.println(countriesMap.get(response.toString()));
    }catch (Exception e){
      System.out.println(e.getMessage());
    }

  }

}
