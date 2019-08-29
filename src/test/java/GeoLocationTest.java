import static org.junit.Assert.assertEquals;

import org.junit.Before;
import org.junit.Test;

public class GeoLocationTest {

  GeoLocation geoLocation;
  String usa = "United States of America";
  String india = "India";
  String my = "Malaysia";
  String singapore = "Singapore";
  String tanzania = "Tanzania, United Republic of";

  @Before
  public void setup(){
    this.geoLocation = GeoLocation.INSTANCE;
  }
  @Test
  public void testFindMax(){
    //17.3850,78.4867 -- Hyderabad
    //23.8927, 91.2438 -- Agartala Airport
    //4.2105, 101.9758 -- malaysia
    //1.421653, 103.935075 -- Singapore
    //37.0902, -95.7129 -- USA
    // -8.7832, 34.5085 -- Africa
    assertEquals(india,geoLocation.getCountry(17.3850,78.4867));
    assertEquals(india,geoLocation.getCountry(23.8927, 91.2438));
    assertEquals(my,geoLocation.getCountry(4.2105, 101.9758));
    assertEquals(singapore,geoLocation.getCountry(1.421653, 103.935075));
    assertEquals(usa,geoLocation.getCountry(37.0902, -95.7129));
    assertEquals(tanzania,geoLocation.getCountry(-8.7832, 34.5085));
  }

}
