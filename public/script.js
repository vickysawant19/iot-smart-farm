// Connect to the server using Socket.IO
// const socket = io({
//   transports: ["websocket"], // Use WebSocket transport
// });

// Connect to the server using Socket.IO
const socket = io("https://iot-smart-farm-production.up.railway.app", {
  transports: ["websocket"], // Use WebSocket transport
});

// Listen for "event" messages from the server
socket.on("event", (data) => {
  console.log("Event received:", data);
});

socket.on("heartbeat", (data) => {
  console.log("Heartbeat received:", data);
});

// Initialize temperature and humidity display with "N/A"
document.getElementById("temperature").innerText = "N/A";
document.getElementById("humidity").innerText = "N/A";

// Listen for "sensorData" messages from the server
socket.on("sensorData", (data) => {
  console.log("Sensor data received:", data);

  // Check if the data contains valid temperature and humidity
  if (
    data &&
    typeof data.temperature !== "undefined" &&
    typeof data.humidity !== "undefined"
  ) {
    document.getElementById("temperature").innerText = data.temperature;
    document.getElementById("humidity").innerText = data.humidity;
  } else {
    console.error("Invalid sensor data received:", data);
  }
});
