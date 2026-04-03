// socket/videoCall.socket.js
const rooms = new Map();

const videoCallSocket = (io) => {
  const videoNS = io.of("/video");

  videoNS.on("connection", (socket) => {
    console.log(`[Video] Socket connected: ${socket.id}`);

    // ── join-room ─────────────────────────────────────────
    socket.on("join-room", ({ roomId, userName, role }) => {
      try {
        // Max 2 participants per room
        const roomPeers = rooms.get(roomId) || [];
        if (roomPeers.length >= 2) {
          socket.emit("error", { message: "Room is full (max 2 participants)" });
          return;
        }

        // Join socket room
        socket.join(roomId);
        socket.roomId   = roomId;
        socket.userName = userName;
        socket.role     = role;

        // Add to rooms map
        roomPeers.push({ socketId: socket.id, userName, role });
        rooms.set(roomId, roomPeers);

        console.log(`[Video] ${userName} (${role}) joined room: ${roomId}`);

        // Tell this socket about existing peers
        const otherPeers = roomPeers.filter((p) => p.socketId !== socket.id);
        socket.emit("room-joined", {
          roomId,
          peersInRoom: otherPeers.map((p) => ({
            socketId: p.socketId,
            userName: p.userName,
            role:     p.role,
          })),
        });

        // Notify others that someone joined
        socket.to(roomId).emit("peer-joined", {
          socketId: socket.id,
          userName,
          role,
        });

      } catch (err) {
        console.error("[Video] join-room error:", err);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // ── WebRTC Offer (caller → callee) ────────────────────
    socket.on("offer", ({ to, offer }) => {
      socket.to(to).emit("offer", {
        from:     socket.id,
        userName: socket.userName,
        offer,
      });
    });

    // ── WebRTC Answer (callee → caller) ───────────────────
    socket.on("answer", ({ to, answer }) => {
      socket.to(to).emit("answer", {
        from:   socket.id,
        answer,
      });
    });

    // ── ICE Candidate exchange ────────────────────────────
    socket.on("ice-candidate", ({ to, candidate }) => {
      socket.to(to).emit("ice-candidate", {
        from:      socket.id,
        candidate,
      });
    });

    // ── Media toggle events ───────────────────────────────
    socket.on("media-toggle", ({ roomId, type, enabled }) => {
      socket.to(roomId).emit("peer-media-toggle", {
        from: socket.id,
        type,
        enabled,
      });
    });

    // ── Chat message during call ──────────────────────────
    socket.on("chat-message", ({ roomId, message }) => {
      videoNS.to(roomId).emit("chat-message", {
        from:      socket.id,
        userName:  socket.userName,
        message,
        timestamp: new Date().toISOString(),
      });
    });

    // ── disconnect ────────────────────────────────────────
    socket.on("disconnect", () => {
      const { roomId, userName } = socket;
      if (!roomId) return;

      const roomPeers = rooms.get(roomId) || [];
      const updated   = roomPeers.filter((p) => p.socketId !== socket.id);

      if (updated.length === 0) {
        rooms.delete(roomId);
      } else {
        rooms.set(roomId, updated);
      }

      socket.to(roomId).emit("peer-left", {
        socketId: socket.id,
        userName,
      });

      console.log(`[Video] ${userName} left room: ${roomId}`);
    });
  });
};

module.exports = videoCallSocket;