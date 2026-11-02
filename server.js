
const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname, {
  index: "index.html",
  extensions: ["html"]
}));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    game: "CUBE WARS",
    players: players.size
  });
});

const players = new Map();

let countdown = null;
let countdownEndsAt = 0;
let matchStarted = false;
let nextPlayerId = 1;

function send(socket, data) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

function broadcast(data) {
  const message = JSON.stringify(data);

  for (const socket of wss.clients) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  }
}

function getPlayerCount() {
  return players.size;
}

function sendQueueState() {
  broadcast({
    type: "queue",
    players: getPlayerCount(),
    required: 2,
    countdown: countdown
      ? Math.max(0, Math.ceil((countdownEndsAt - Date.now()) / 1000))
      : null,
    matchStarted
  });
}

function stopCountdown() {
  if (countdown) {
    clearTimeout(countdown);
    countdown = null;
  }

  countdownEndsAt = 0;
}

function checkQueue() {
  const count = getPlayerCount();

  if (matchStarted) {
    sendQueueState();
    return;
  }

  if (count < 2) {
    stopCountdown();
    sendQueueState();
    return;
  }

  if (!countdown) {
    countdownEndsAt = Date.now() + 10000;

    broadcast({
      type: "countdown",
      seconds: 10
    });

    sendQueueState();

    countdown = setTimeout(() => {
      countdown = null;

      if (getPlayerCount() < 2) {
        sendQueueState();
        return;
      }

      matchStarted = true;

      broadcast({
        type: "match-start",
        players: getPlayerCount()
      });

      sendQueueState();
    }, 10000);
  } else {
    sendQueueState();
  }
}

wss.on("connection", socket => {
  const id = String(nextPlayerId++);

  players.set(socket, {
    id,
    x: 0,
    y: 0,
    z: 0
  });

  send(socket, {
    type: "connected",
    id
  });

  console.log("Spieler verbunden:", id);

  checkQueue();

  socket.on("message", raw => {
    let data;

    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const player = players.get(socket);
    if (!player) return;

    if (data.type === "position" && matchStarted) {
      player.x = Number(data.x) || 0;
      player.y = Number(data.y) || 0;
      player.z = Number(data.z) || 0;

      broadcast({
        type: "player-position",
        id: player.id,
        x: player.x,
        y: player.y,
        z: player.z
      });
    }
  });

  socket.on("close", () => {
    const player = players.get(socket);

    if (player) {
      console.log("Spieler getrennt:", player.id);
      players.delete(socket);

      broadcast({
        type: "player-left",
        id: player.id
      });
    }

    checkQueue();
  });

  socket.on("error", error => {
    console.error("WebSocket-Fehler:", error.message);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("CUBE WARS läuft auf Port", PORT);
});
