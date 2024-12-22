const socket = io("http://192.168.1.7:3000", {
  transports: ["websocket"],
});

socket.on("event", (data) => {
  console.log("Event received:", data);
});

document.getElementById("temperature").innerText = "Na";
document.getElementById("humidity").innerText = "Na";

socket.on("sensorData", (data) => {
  console.log("Sensor data received:", data);
  document.getElementById("temperature").innerText = data.temperature;
  document.getElementById("humidity").innerText = data.humidity;
});
