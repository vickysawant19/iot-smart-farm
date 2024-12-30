import express from "express";

const app = express();

import http from "http";
const server = http.createServer(app);

import { Server } from "socket.io";
import appwriteService from "./appwrite/service.js";

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

// Constants
const SENSOR_DATA_INTERVAL = 30 * 60 * 1000; // 30 minutes
const SENSOR_CHECK_INTERVAL = 60 * 1000; // 1 minute

const devices = new Map();
const client = new Map();

io.on("connection", (socket) => {
  // console.log(`Client connected: ${socket.id}`);

  socket.on("register", ({ chipId }) => {
    if(!devices.get(chipId)){
      devices.set(chipId, { socketId: socket.id, lastStoredTime: 0 });
      socket.emit("registerConfirm", chipId);
      console.log(`Chip registered: ${chipId}`);
    }
    console.log("chip already connected")
    // Notify all client connections about the chip connection
    client.forEach((chipIds, clientSocketId) => {
      if (chipIds.some((id) => id === chipId)) {
        io.to(clientSocketId).emit("chipConnected", {
          chipId,
          status: "connected",
        });
      }
    });
  });

  socket.on("clientRegister", (chipIds) => {
    console.log("Client registered for chips: ", chipIds);
    client.set(socket.id, chipIds); // Map clientSocketId to chipIds array
    chipIds.forEach((chipId) => {
      if (!devices.has(chipId)) {
        // console.log(`Chip ${chipId} not connected.`);
        socket.emit("error", `Chip ${chipId} not connected.`);
      } else {
        // console.log(`Chip ${chipId} connected.`);
        socket.emit("success", {
          chipId,
          message: `Chip ${chipId} connected.`,
        });
      }
    });
  });

  //motor status change action from client to device
  socket.on("motor_action", (msg) => {
    const { chipId, status } = msg;
    if (!chipId || !status) {
      socket.emit("error", "chipId or status not provided.");
      return;
    }
    if (!devices.has(chipId)) {
      socket.emit("error", `Chip ${chipId} not connected.`);
      return;
    }
    io.to(devices.get(chipId).socketId).emit("motor_action", msg);
  });

  socket.on("sensorDataRequest", (msg) => {
    const { chipId } = msg;
    if (!chipId) {
      console.log("chipId not provided in sensorDataRequest.");
      socket.emit("error", "chipId not provided in sensorDataRequest.");
      return;
    }
    if (!devices.has(chipId)) {
      // console.log(`Chip ${chipId} not connected.`);
      socket.emit("error", `Chip ${chipId} not connected.`);
    } else {
      io.to(devices.get(chipId).socketId).emit("sensorDataRequest", msg);
    }
  });

  //responce from sensor device
  socket.on("sensorDataResponse", async (msg) => {
    const {
      chipId,
      temperature,
      humidity,
      soilMoisture,
      lightIntensity,
      motorStatus,
    } = msg;
    if (!chipId) {
      console.log("chipId not provided in sensorDataResponse.");
      socket.emit("error", "chipId not provided.");
      return;
    }
    if (!devices.has(chipId)) {
      console.log(
        `Chip ${chipId} not saved. Storing chip ${chipId} with socket id ${socket.id}.`
      );
      devices.set(chipId, { socketId: socket.id, lastStoredTime: 0 });
    }
    client.forEach((chipIds, clientSocketId) => {
      if (chipIds.some((id) => id === chipId)) {
        io.to(clientSocketId).emit("sensorDataResponse", msg);
      }
    });

    // Track the last stored time for each chip
    if (!devices.get(chipId).lastStoredTime) {
      devices.get(chipId).lastStoredTime = 0;
    }

    const currentTime = Date.now();
    const lastStoredTime = devices.get(chipId).lastStoredTime;
    const interval = 30 * 60 * 1000; // 30 minutes in milliseconds

    if (currentTime - lastStoredTime >= interval) {
      try {
        devices.get(chipId).lastStoredTime = currentTime;
        await appwriteService.storeSensorData(
          chipId,
          parseInt(temperature),
          parseInt(humidity),
          parseInt(soilMoisture),
          parseInt(lightIntensity),
          motorStatus
        );
      } catch (error) {
        console.error(
          `Failed to store sensor data for chip ${chipId}:`,
          error.message
        );
      }
    }
  });

  //motor status response from device
  socket.on("motorStatusResponse", (msg) => {
    const { chipId } = msg;
    if (!chipId) {
      console.log("chipId not provided in motorStatusResponse.");
      socket.emit("error", "chipId not provided.");
      return;
    }
    if (!devices.has(chipId)) {
      console.log(
        `Chip ${chipId} not saved. Storing chip ${chipId} with socket id ${socket.id}.`
      );
      devices.set(chipId, { socketId: socket.id, lastStoredTime: 0 });
    }
    client.forEach((chipIds, clientSocketId) => {
      if (chipIds.some((id) => id === chipId)) {
        io.to(clientSocketId).emit("motorStatusResponse", msg);
      }
    });
  });

  socket.on("heartbeat", (msg) => {
    const { chipId } = msg;
    //send heartbeat to client with same chipId
    client.forEach((chipIds, clientSocketId) => {
      if (chipIds.some((id) => id === chipId)) {
        io.to(clientSocketId).emit("heartbeat", msg);
      }
    });
  });

  //socket event to request sensor data from device with interval of 30 minutes if exceeded then store data in appwrite
  if (!global.sensorDataInterval) {
    global.sensorDataInterval = setInterval(() => {
      devices.forEach(({ socketId, lastStoredTime }, chipId) => {
        const interval = 30 * 60 * 1000; // 30 minutes in milliseconds
        const currentTime = Date.now();
        if (currentTime - lastStoredTime >= interval) {
          io.to(socketId).emit("sensorDataRequest", {
            chipId,
          });
        }
      });
    }, 60 * 1000);
  }

  //
  // Handle disconnection
  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected: ${socket.id}, Reason: ${reason}`);
    // Get chipId using socket.id from devices
    let disconnectedChipId = null;
    for (const [chipId, chipSocketId] of devices.entries()) {
      if (chipSocketId.socketId === socket.id) {
        disconnectedChipId = chipId;
        console.log(`Removing chip ${chipId} from connections.`);
        devices.delete(chipId);
        break;
      }
    }
    // Notify all client connections about the chip disconnection
    if (disconnectedChipId) {
      client.forEach((chipIds, clientSocketId) => {
        if (chipIds.some((chipId) => chipId === disconnectedChipId)) {
          io.to(clientSocketId).emit("chipDisconnected", {
            chipId: disconnectedChipId,
            status: "disconnected",
          });
        }
      });
    }
  });
});

setInterval(() => {
  const currentTime = Date.now();
  devices.forEach(({ socketId, lastStoredTime }, chipId) => {
    if (currentTime - lastStoredTime >= SENSOR_DATA_INTERVAL) {
      io.to(socketId).emit("sensorDataRequest", { chipId });
    }
  });
}, SENSOR_CHECK_INTERVAL);

const PORT = process.env.PORT || 3000;

server
  .listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  })
  .on("error", (err) => {
    console.error("Server error:", err);
  });
