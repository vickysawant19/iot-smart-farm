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

  socket.on("register", ({ chipId }) => {
    console.log(`Chip registered: ${chipId}`);
    chipConnections[chipId] = socket.id;
    socket.emit("registerConfirm", chipId);
  });

  socket.on("heartbeat", (msg) => {
    console.log(`Data received from ${socket.id}:`, msg);
    console.log(chipConnections);
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
