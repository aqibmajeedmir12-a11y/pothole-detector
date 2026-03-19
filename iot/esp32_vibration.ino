#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

const char* ssid = "Wokwi-GUEST";
const char* password = "";

String apiKey = "5HXILJIDPZS4TPPG";
const char* server = "api.thingspeak.com";

#define SENSOR_PIN 34
#define LED_PIN 2
#define BUZZER_PIN 25

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

int potholeCount = 0;
bool potholeDetected = false;

void setup() {

  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  Wire.begin(21,22);

  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED not found");
    while(true);
  }

  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(WHITE);
  display.setCursor(10,20);
  display.println("AIoT Road");
  display.display();
  delay(2000);

  WiFi.begin(ssid, password);

  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0,0);
  display.println("Connecting WiFi...");
  display.display();

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi Connected");

  display.clearDisplay();
  display.setCursor(0,0);
  display.println("WiFi Connected");
  display.println("ThingSpeak Ready");
  display.display();
  delay(2000);
}

void loop() {

  int vibration = analogRead(SENSOR_PIN);
  int pothole = 0;

  display.clearDisplay();

  display.setTextSize(1);
  display.setCursor(0,0);
  display.print("Vibration: ");
  display.println(vibration);

  if(vibration > 2000){

    digitalWrite(LED_PIN,HIGH);
    tone(BUZZER_PIN, 1000);
    pothole = 1;

    if(!potholeDetected){
      potholeCount++;
      potholeDetected = true;
    }

    display.setTextSize(2);
    display.setCursor(0,18);
    display.println("POTHOLE!");

  }else{

    digitalWrite(LED_PIN,LOW);
    noTone(BUZZER_PIN);
    potholeDetected = false;

    display.setTextSize(2);
    display.setCursor(0,18);
    display.println("ROAD OK");
  }

  display.setTextSize(1);
  display.setCursor(0,50);
  display.print("Count: ");
  display.print(potholeCount);

  display.display();

  WiFiClient client;

  if(client.connect(server,80)){

    String url = "/update?api_key=" + apiKey +
                 "&field1=" + vibration +
                 "&field2=" + pothole +
                 "&field3=" + potholeCount;

    client.print(String("GET ") + url + " HTTP/1.1\r\n" +
                 "Host: " + server + "\r\n" +
                 "Connection: close\r\n\r\n");

    Serial.println("Data sent to ThingSpeak");
  }

  delay(16000);
}
