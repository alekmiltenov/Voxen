#include <WiFi.h>
#include <WebSocketsClient.h>
#include <Wire.h>

#define CAMERA_MODEL_XIAO_ESP32S3
#include "esp_camera.h"

// ================= WIFI =================
const char* ssid = "Kamen's A34";
const char* password = "cumenenazi";

// ================= SERVER =================
const char* host = "10.240.220.128";
const int port = 8000;

// ================= SOCKETS =================
WebSocketsClient camSocket;
WebSocketsClient imuSocket;

// ================= MPU =================
#define MPU_ADDR 0x68

void initMPU() {
  Wire.begin();

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0);
  Wire.endTransmission(true);

  Serial.println("MPU OK");
}

void readMPU(float &x, float &y, float &z) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);

  int16_t ax = Wire.read() << 8 | Wire.read();
  int16_t ay = Wire.read() << 8 | Wire.read();
  int16_t az = Wire.read() << 8 | Wire.read();

  x = ax / 16384.0;
  y = ay / 16384.0;
  z = az / 16384.0;
}

// ================= CAMERA PINS =================
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

// ================= TIMING =================
uint32_t lastFrame = 0;
uint32_t lastIMU = 0;
uint32_t lastPing = 0;

const int FRAME_INTERVAL = 400; // ~3 FPS
const int IMU_INTERVAL = 100;   // 10 Hz
const int PING_INTERVAL = 3000;

// ================= CAMERA INIT =================
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

  // 🔥 OPTIMIZED SETTINGS
  config.frame_size = FRAMESIZE_QCIF; // MUCH smaller
  config.jpeg_quality = 20;            // less data
  config.fb_count = 3;

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("Camera init failed");
    while (1);
  }

  Serial.println("Camera OK");
}

// ================= WS EVENTS =================
void camEvent(WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) Serial.println("[CAM] Connected");
  if (type == WStype_DISCONNECTED) Serial.println("[CAM] Disconnected");
}

void imuEvent(WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) Serial.println("[IMU] Connected");
  if (type == WStype_DISCONNECTED) Serial.println("[IMU] Disconnected");
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  delay(1000);

  WiFi.begin(ssid, password);
  Serial.print("WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println(" OK");

  initMPU();
  initCamera();

  camSocket.begin(host, port, "/ws/esp32/camera");
  camSocket.onEvent(camEvent);
  camSocket.setReconnectInterval(2000);

  imuSocket.begin(host, port, "/ws/esp32/imu");
  imuSocket.onEvent(imuEvent);
  imuSocket.setReconnectInterval(2000);
}

// ================= LOOP =================
void loop() {
  // 🔥 PRIORITY: CAMERA FIRST
  camSocket.loop();
  imuSocket.loop();

  uint32_t now = millis();

  // ===== KEEP ALIVE =====
  if (now - lastPing > PING_INTERVAL) {
    lastPing = now;
    camSocket.sendTXT("{\"type\":\"ping\"}");
  }
if (now - lastFrame < FRAME_INTERVAL) {
  return;
}
  // ===== CAMERA STREAM =====
  if (camSocket.isConnected() && now - lastFrame >= FRAME_INTERVAL) {
    lastFrame = now;

    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) return;

    // META (IMPORTANT)
    char meta[128];
    snprintf(meta, sizeof(meta),
      "{\"type\":\"meta\",\"t\":%lu}",
      millis()
    );

    camSocket.sendTXT(meta);
    camSocket.sendBIN(fb->buf, fb->len);

    esp_camera_fb_return(fb);

    yield(); // 🔥 CRITICAL
  }

  // ===== IMU STREAM =====
  if (imuSocket.isConnected() && now - lastIMU >= IMU_INTERVAL) {
    lastIMU = now;

    float x, y, z;
    readMPU(x, y, z);

    char json[128];
    snprintf(json, sizeof(json),
      "{\"x\":%.3f,\"y\":%.3f,\"z\":%.3f,\"timestamp\":%lu}",
      x, y, z, millis()
    );

    imuSocket.sendTXT(json);
  }
  
}

/*old CODE IT IS NOT ACTIVE:
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
const char* host = "10.240.220.128"; // <-- сложи твоя IP
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