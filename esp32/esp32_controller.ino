#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <WiFi.h>
#include <HTTPClient.h>

Adafruit_MPU6050 mpu;

const char* ssid = "Kamen's A34";
const char* password = "cumenenazi";

const char* serverUrl = "http://10.159.169.128:5000/data"; // смени IP

void setup() {
  Serial.begin(115200);
  Wire.begin(33, 32);

  if (!mpu.begin()) {
    Serial.println("MPU6050 not found!");
    while (1);
  }

  WiFi.begin(ssid, password);
  Serial.print("Connecting");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nConnected!");
}

void loop() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  float x = a.acceleration.x;
  float y = a.acceleration.y;
  float z = a.acceleration.z;

  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");

  String json = "{\"x\":" + String(x, 2) +
                ",\"y\":" + String(y, 2) +
                ",\"z\":" + String(z, 2) + "}";

  int res = http.POST(json);

  Serial.print("Sent RAW | Response: ");
  Serial.println(res);

  http.end();

  delay(100);
}