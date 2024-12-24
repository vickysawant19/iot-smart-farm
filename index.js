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

const devices = new Map();
const client = new Map();

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("register", ({ chipId }) => {
    console.log(`Chip registered: ${chipId}`);
    devices.set(chipId, socket.id);
    socket.emit("registerConfirm", chipId);

    // Notify all client connections about the chip connection
    client.forEach((chipIds, clientSocketId) => {
      if (chipIds.some(({ chipId: id }) => id === chipId)) {
        io.to(clientSocketId).emit("chipConnected", {
          chipId,
          status: "connected",
        });
      }
    });
  });

  socket.on("clientRegister", (chipIds) => {
    console.log(`Client registered for chips: ${chipIds}`);
    client.set(socket.id, chipIds); // Map clientSocketId to chipIds array
    console.log("chipsIds", chipIds);

    chipIds.forEach(({ chipId }) => {
      if (!devices.has(chipId)) {
        console.log(`Chip ${chipId} not connected.`);
        socket.emit("error", `Chip ${chipId} not connected.`);
      } else {
        console.log(`Chip ${chipId} connected.`);
        socket.emit("success", {
          chipId,
          message: `Chip ${chipId} connected.`,
        });
      }
    });
  });

  socket.on("motor_action", (msg) => {
    const { chipId } = msg;
    if (!devices.has(chipId)) {
      console.log(`Chip ${chipId} not connected.`);
      socket.emit("error", `Chip ${chipId} not connected.`);
    } else {
      io.to(devices.get(chipId)).emit("motor_action", msg);
      console.log(`Data sent to ${devices.get(chipId)}:`, msg);
    }
  });

  socket.on("sensorDataRequest", (msg) => {
    const { chipId } = msg;
    if (!chipId) {
      console.log("chipId not provided in sensorDataRequest.");
      socket.emit("error", "chipId not provided.");
      return;
    }
    if (!devices.has(chipId)) {
      console.log(`Chip ${chipId} not connected.`);
      socket.emit("error", `Chip ${chipId} not connected.`);
    } else {
      io.to(devices.get(chipId)).emit("sensorDataRequest", msg);
      // console.log(`Data Request sent to ${devices.get(chipId)}:`, msg);
    }
  });

  //responce from sensor device
  socket.on("sensorDataResponse", (msg) => {
    const { chipId } = msg;
    if (!chipId) {
      console.log("chipId not provided in sensorDataResponse.");
      socket.emit("error", "chipId not provided.");
      return;
    }
    if (!devices.has(chipId)) {
      console.log(
        `Chip ${chipId} not saved. Storing chip ${chipId} with socket id ${socket.id}.`
      );
      devices.set(chipId, socket.id);
    }
    console.log(`Data received from chip ${chipId}:`, msg);
    client.forEach((chipIds, clientSocketId) => {
      if (chipIds.some(({ chipId: id }) => id === chipId)) {
        io.to(clientSocketId).emit("sensorDataResponse", msg);
      }
    });
  });

  //motor status change action from client to device
  socket.on("motor_action", (msg) => {
    const { chipId, status } = msg;
    if (!chipId || !status) {
      console.log("chipId or status not provided in motor_action.");
      socket.emit("error", "chipId or status not provided.");
      return;
    }
    if (!devices.has(chipId)) {
      console.log(
        `Chip ${chipId} not saved. Storing chip ${chipId} with socket id ${socket.id}.`
      );
      socket.emit("error", `Chip ${chipId} not connected.`);
      return;
    }
    console.log(`Data received from chip ${chipId}:`, msg);
    io.to(devices.get(chipId)).emit("motor_action", msg);
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
      devices.set(chipId, socket.id);
    }
    console.log(`Data received from chip ${chipId}:`, msg);
    client.forEach((chipIds, clientSocketId) => {
      if (chipIds.some(({ chipId: id }) => id === chipId)) {
        io.to(clientSocketId).emit("motorStatusResponse", msg);
      }
    });
  });

  socket.on("heartbeat", (msg) => {
    const { chipId } = msg;
    if (!devices.has(chipId)) {
      devices.set(chipId, socket.id);
      console.log(`Chip ${chipId} added to connections.`);
    }
    //send heartbeat to client with same chipId
    client.forEach((chipIds, clientSocketId) => {
      if (chipIds.some(({ chipId: id }) => id === chipId)) {
        io.to(clientSocketId).emit("heartbeat", msg);
      }
    });
    // console.log(`Data received from ${socket.id}:`, msg);
    // console.log(client, devices);
  });

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected: ${socket.id}, Reason: ${reason}`);
    // Get chipId using socket.id from devices
    let disconnectedChipId = null;
    for (const [chipId, chipSocketId] of devices.entries()) {
      if (chipSocketId === socket.id) {
        disconnectedChipId = chipId;
        console.log(`Removing chip ${chipId} from connections.`);
        devices.delete(chipId);
        break;
      }
    }
    // Notify all client connections about the chip disconnection
    if (disconnectedChipId) {
      client.forEach((chipIds, clientSocketId) => {
        if (chipIds.some(({ chipId }) => chipId === disconnectedChipId)) {
          io.to(clientSocketId).emit("chipDisconnected", {
            chipId: disconnectedChipId,
            status: "disconnected",
          });
        }
      });
    }
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
