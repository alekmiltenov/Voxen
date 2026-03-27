#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <WiFi.h>
#include <HTTPClient.h>

Adafruit_MPU6050 mpu;

const char* ssid     = "Kamen's A34";
const char* password = "cumenenazi";

const char* serverHost = "10.237.97.128";
const int   serverPort = 5000;
const char* serverPath = "/data";

// Reuse a single WiFiClient across requests to avoid
// TCP handshake overhead on every loop iteration.
WiFiClient wifiClient;
HTTPClient http;

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
  Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
}

void loop() {
  // -------- READ SENSOR --------
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  float x = a.acceleration.x;
  float y = a.acceleration.y;
  float z = a.acceleration.z;

  // -------- SEND DATA --------
  // begin() with host/port/path reuses the underlying TCP connection
  // instead of opening a new socket every time.
  http.begin(wifiClient, serverHost, serverPort, serverPath);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(200); // fail fast, don't block loop

  String json = "{\"x\":" + String(x, 2) +
                ",\"y\":" + String(y, 2) +
                ",\"z\":" + String(z, 2) + "}";

  int code = http.POST(json);

  // Only log errors — serial print on every loop wastes ~1ms
  if (code < 0) {
    Serial.println("POST failed: " + String(code));
  }

  http.end();

  delay(50); // 20 Hz — matches backend processing rate
}
