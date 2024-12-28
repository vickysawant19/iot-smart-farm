void setup() {
    // Initialize serial communication at 115200 baud rate
    Serial.begin(115200);
}

void loop() {
    // Read the value from the moisture sensor on A0 pin
    int sensorValue = analogRead(A0);
    
    
    // Map the sensor value to a moisture percentage (assuming sensor value ranges from 600 to 1024)
    float moisturePercentage = 100 - (((sensorValue - 600) / (1024.0 - 600)) * 100.0);
    // moisture_level = (sensor_value - min_value) / (max_value - min_value) * 100
    
    
    // Print the sensor value and moisture percentage to the Serial Monitor
    Serial.print("Moisture Sensor Value: ");
    Serial.print(sensorValue);
    Serial.print(" - Moisture Percentage: ");
    Serial.print(moisturePercentage);
    Serial.println("%");
    
    // Wait for 1 second before taking another reading
    delay(1000);
}