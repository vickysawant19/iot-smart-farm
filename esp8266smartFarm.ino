/*
 * WebSocketClientSocketIO.ino
 *
 *  Created on: 06.06.2016
 *   smart farm version 2
 */

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <WiFiManager.h> // WiFiManager library
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <SocketIOclient.h>
#include <Hash.h>

SocketIOclient socketIO;

#define USE_SERIAL Serial

// Function to send events back to the server
void sendEvent(const String& eventName, JsonObject& data) {
    DynamicJsonDocument doc(1024);
    JsonArray array = doc.to<JsonArray>();

    // Add event name
    array.add(eventName);

    // Add payload (parameters) for the event
    array.add(data);

    // Serialize to string
    String output;
    serializeJson(doc, output);

    // Send event to the server
    socketIO.sendEVENT(output);

    USE_SERIAL.println("Sent event: " + eventName + " with data: " + output);
}

// Function to handle events
void handleSocketEvent(String event, JsonObject& data) {
    if (event == "lightControl") {
        String status = data["status"];
        if (status == "on") {
            digitalWrite(LED_BUILTIN, LOW);
            USE_SERIAL.println("Light turned ON");
        } else if (status == "off") {
            digitalWrite(LED_BUILTIN, HIGH);
            USE_SERIAL.println("Light turned OFF");
        }

        // Prepare response payload
        DynamicJsonDocument responseDoc(1024);
        JsonObject responseData = responseDoc.to<JsonObject>();
        responseData["status"] = digitalRead(LED_BUILTIN) == LOW ? "ON" : "OFF";
        sendEvent("statusResponse", responseData);
    } else if (event == "statusRequest") {
        // Respond with the current light status
        DynamicJsonDocument responseDoc(1024);
        JsonObject responseData = responseDoc.to<JsonObject>();
        responseData["status"] = digitalRead(LED_BUILTIN) == LOW ? "ON" : "OFF";
        sendEvent("statusResponse", responseData);
    } else if (event == "customEvent") {
        String customMessage = data["message"];
        USE_SERIAL.println("Custom Event Received: " + customMessage);
    } else {
        USE_SERIAL.println("Unhandled event: " + event);
    }
}

// Socket.IO event handler
void socketIOEvent(socketIOmessageType_t type, uint8_t* payload, size_t length) {
    switch (type) {
        case sIOtype_DISCONNECT:
            USE_SERIAL.printf("[IOc] Disconnected!\n");
            break;

        case sIOtype_CONNECT:
            USE_SERIAL.printf("[IOc] Connected to URL: %s\n", payload);
            socketIO.send(sIOtype_CONNECT, "/");
            break;

        case sIOtype_EVENT: {
            USE_SERIAL.printf("[IOc] Event received: %s\n", payload);

            // Parse incoming payload
            DynamicJsonDocument doc(1024);
            DeserializationError error = deserializeJson(doc, payload, length);
            if (error) {
                USE_SERIAL.printf("JSON Parsing Error: %s\n", error.c_str());
                return;
            }

            // Extract event name and data
            String event = doc[0].as<String>();
            JsonObject data = doc[1].as<JsonObject>();

            // Pass event to handler
            handleSocketEvent(event, data);
            break;
        }

        case sIOtype_ACK:
            USE_SERIAL.printf("[IOc] ACK received: %u\n", length);
            break;

        case sIOtype_ERROR:
            USE_SERIAL.printf("[IOc] Error received: %u\n", length);
            break;

        case sIOtype_BINARY_EVENT:
            USE_SERIAL.printf("[IOc] Binary event received: %u\n", length);
            break;

        case sIOtype_BINARY_ACK:
            USE_SERIAL.printf("[IOc] Binary ACK received: %u\n", length);
            break;

        default:
            USE_SERIAL.printf("[IOc] Unknown event type: %u\n", type);
            break;
    }
}


void setup() {
    // Begin serial communication
    USE_SERIAL.begin(115200);
    USE_SERIAL.setDebugOutput(true);

    // Set up LED
    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_BUILTIN, HIGH); // Default: LED OFF

    USE_SERIAL.println("\n\nStarting WiFiManager setup...");

    // Create WiFiManager instance
    WiFiManager wifiManager;

    // Block and wait for configuration
    if (!wifiManager.autoConnect("SmartFarmAP")) {
        USE_SERIAL.println("Failed to connect and hit timeout. Restarting...");
        delay(3000);
        ESP.restart();
    }

    USE_SERIAL.println("Connected to Wi-Fi successfully!");
    USE_SERIAL.printf("[SETUP] WiFi Connected. IP: %s\n", WiFi.localIP().toString().c_str());

    // Socket.IO setup
    socketIO.begin("192.168.1.7", 3000, "/socket.io/?EIO=4");

    // Event handler
    socketIO.onEvent(socketIOEvent);
}

unsigned long messageTimestamp = 0;

void loop() {
    socketIO.loop();

    uint64_t now = millis();

    if (now - messageTimestamp > 2000) {
        messageTimestamp = now;

        // Heartbeat event
        DynamicJsonDocument doc(1024);
        JsonArray array = doc.to<JsonArray>();

        array.add("heartbeat");
        JsonObject param1 = array.createNestedObject();
        param1["timestamp"] = (uint32_t) now;

        String output;
        serializeJson(doc, output);
        socketIO.sendEVENT(output);

        USE_SERIAL.println(output);
    }
}
