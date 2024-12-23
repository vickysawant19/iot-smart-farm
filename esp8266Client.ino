#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <WiFiManager.h>
#include <SocketIoClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>

// DHT sensor settings
#define DHTPIN D4 // Pin where the DHT sensor is connected
#define DHTTYPE DHT11 // DHT 11

DHT dht(DHTPIN, DHTTYPE);

const char* host = "iot-smart-farm-production.up.railway.app"; // Your Railway server URL
const int port = 443; // HTTPS port
WiFiClientSecure secureClient;
SocketIoClient socket;

// Variables for timing and connection state
unsigned long previousMillis = 0;
bool isConnected = false;

// Event handler for connection
void onConnect(const char * payload, size_t length) {
  Serial.println("Connected to Socket.IO server");
  isConnected = true;
}

// Event handler for disconnection
void onDisconnect(const char * payload, size_t length) {
  Serial.println("Disconnected from Socket.IO server");
  isConnected = false;
}

// Function to send temperature and humidity data
void sendSensorData() {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  // Check if any reads failed and generate random values if necessary
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Failed to read from DHT sensor! Generating random values.");
    humidity = random(20, 80); // Random humidity between 20% and 80%
    temperature = random(15, 30); // Random temperature between 15°C and 30°C
  }

  // Create JSON payload
  String payload = "{\"temperature\": " + String(temperature) + ", \"humidity\": " + String(humidity) + "}";
  socket.emit("sensorData", payload.c_str());
}

void setup() {
  Serial.begin(115200);

  // Initialize DHT sensor
  dht.begin();

  // Initialize WiFiManager
  WiFiManager wifiManager;
  wifiManager.autoConnect("ESP8266_AP");

  // Initialize Socket.IO connection
  socket.on("connect", onConnect);
  socket.on("disconnect", onDisconnect);
  socket.beginSSL(host, port);
}

void loop() {
  // Maintain the Socket.IO connection
  socket.loop();

  // Send sensor data every 5 seconds if connected
  unsigned long currentMillis = millis();
  if (isConnected && currentMillis - previousMillis >= 5000) {
    previousMillis = currentMillis;
    sendSensorData();
  }
}
