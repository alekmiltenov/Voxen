// code for cam live ws:
#include <WiFi.h>
#include <WebSocketsClient.h>
#include "esp_camera.h"


// XIAO ESP32S3 Sense camera pins (официален)
#define PWDN_GPIO_NUM    -1
#define RESET_GPIO_NUM   -1
#define XCLK_GPIO_NUM    10
#define SIOD_GPIO_NUM    40
#define SIOC_GPIO_NUM    39

#define Y9_GPIO_NUM      48
#define Y8_GPIO_NUM      11
#define Y7_GPIO_NUM      12
#define Y6_GPIO_NUM      14
#define Y5_GPIO_NUM      16
#define Y4_GPIO_NUM      18
#define Y3_GPIO_NUM      17
#define Y2_GPIO_NUM      15
#define VSYNC_GPIO_NUM   38
#define HREF_GPIO_NUM    47
#define PCLK_GPIO_NUM    13

// WIFI
const char* ssid = "Kamen's A34";
const char* password = "cumenenazi";
// SERVER
const char* host = "10.49.87.128"; // <-- сложи твоя IP
const int port = 8000;
const char* path = "/ws/esp32/camera";

WebSocketsClient webSocket;

uint32_t seq = 0;
uint32_t lastFrame = 0;
const int FPS = 5;
const int FRAME_INTERVAL = 1000 / FPS;

// ───────────────── CAMERA INIT (FIXED) ─────────────────

void initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;

  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;

  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;

  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;

  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;

  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  config.frame_size = FRAMESIZE_QVGA;
  config.jpeg_quality = 12;
  config.fb_count = 2;

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("Camera init failed ❌");
    while (1);
  }

  Serial.println("Camera OK ✅");


  // 🧪 SENSOR CHECK
  sensor_t * s = esp_camera_sensor_get();
  if (s == NULL) {
    Serial.println("Sensor NOT detected ❌");
  } else {
    Serial.println("Sensor detected ✅");
  }
}

// ───────────────── WS EVENTS ─────────────────
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.println("WS Connected ✅");
  } else if (type == WStype_DISCONNECTED) {
    Serial.println("WS Disconnected ❌");
  }
}

void setup() {
   Serial.println("SETUP START");
  Serial.begin(115200);
  delay(1000);

  Serial.println("SETUP START");

  // WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi OK ✅");

  // Camera
  initCamera();

  // WebSocket
  webSocket.begin(host, port, path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(2000);
}

void loop() {
  webSocket.loop();

  uint32_t now = millis();
  if (now - lastFrame < FRAME_INTERVAL) return;
  lastFrame = now;

  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Frame capture failed ❌");
    return;
  }

  if (webSocket.isConnected()) {
    // META
    char meta[128];
    snprintf(meta, sizeof(meta),
      "{\"type\":\"meta\",\"seq\":%lu,\"t_capture_ms\":%lu}",
      seq++, millis());

    webSocket.sendTXT(meta);

    // IMAGE
    webSocket.sendBIN(fb->buf, fb->len);

    Serial.println("Frame sent ✅");
  }

  esp_camera_fb_return(fb);
  delay(5);
}


/*

==========Old Code only for the accelerometor!================

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
*/