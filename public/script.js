const socket = io("http://192.168.1.7:3000", {
  transports: ["websocket"],
});

socket.on("event", (data) => {
  console.log("Event received:", data);
});
