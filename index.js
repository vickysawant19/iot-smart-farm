import express from "express";

const app = express();

import http from "http";
const server = http.createServer(app);

import { Server } from "socket.io";
const io = new Server(server, {
  pingInterval: 10000,
  pingTimeout: 60000,
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    transports: ["websocket", "polling"],
    credentials: true,
  },
  allowEIO3: true,
});

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const chipConnections = {};

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("register", (chipcode) => {
    console.log(`Chip registered: ${chipcode}`);
    chipConnections[chipcode] = socket.id;
    socket.emit("registerConfirm", chipcode);
  });

  socket.on("sensorData", (msg) => {
    console.log(`Data received from ${socket.id}:`, msg);
    io.emit("sensorData", msg);
  });

  socket.on("heartbeat", (msg) => {
    console.log(`Data received from ${socket.id}:`, msg);
  });

  setInterval(() => {
    socket.emit("statusRequest", "status");
  }, 5000);

  socket.on("statusResponse", (msg) => {
    console.log(`Status received from ${socket.id}:`, msg);
  });

  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected: ${socket.id}, Reason: ${reason}`);
  });
});

const PORT = process.env.PORT || 3000;

server
  .listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  })
  .on("error", (err) => {
    console.error("Server error:", err);
  });
