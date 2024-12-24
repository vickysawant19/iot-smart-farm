// Connect to the server using Socket.IO
// const socket = io({
//   transports: ["websocket"], // Use WebSocket transport
// });

// Connect to the server using Socket.IO
const socket = io("https://iot-smart-farm-production.up.railway.app", {
  transports: ["websocket"], // Use WebSocket transport
});

// Initialize temperature and humidity display with "N/A"
document.getElementById("temperature").innerText = "N/A";
document.getElementById("humidity").innerText = "N/A";
