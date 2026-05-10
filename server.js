const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// ── Stato condiviso in memoria ──────────────────────────────────────────────
let state = {
  breakCaller: null,
  breakTime: null,
  secondsLeft: 0,
  joiners: [],
  message: "",
  history: [],
};

let timerInterval = null;

const BREAK_DURATION = 15 * 60;
const MESSAGES = [
  "☕ Coffee Break Brothers!",
  "🧘 Eeee Bbbast!",
  "🚶 LM, liev 'man!",
  "🍵 Uagliù LM!",
  "😌 MO' BAST, LM!",
];

function broadcast() {
  io.emit("state", state);
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (state.secondsLeft <= 1) {
      endBreak();
    } else {
      state.secondsLeft -= 1;
      broadcast();
    }
  }, 1000);
}

function endBreak() {
  clearInterval(timerInterval);
  if (state.breakCaller) {
    state.history = [
      {
        caller: state.breakCaller,
        time: state.breakTime,
        joiners: [...state.joiners],
      },
      ...state.history.slice(0, 4),
    ];
  }
  state.breakCaller = null;
  state.breakTime = null;
  state.secondsLeft = 0;
  state.joiners = [];
  state.message = "";
  broadcast();
}

// ── WebSocket events ────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("✅ Client connesso:", socket.id);

  // Invia lo stato attuale al nuovo client
  socket.emit("state", state);

  socket.on("callBreak", ({ user }) => {
    if (state.breakCaller) return; // già in pausa
    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    state.breakCaller = user;
    state.breakTime = new Date().toISOString();
    state.secondsLeft = BREAK_DURATION;
    state.joiners = [user];
    state.message = msg;
    broadcast();
    startTimer();
  });

  socket.on("joinBreak", ({ user }) => {
    if (!state.breakCaller) return;
    if (!state.joiners.includes(user)) {
      state.joiners.push(user);
      broadcast();
    }
  });

  socket.on("endBreak", () => {
    endBreak();
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnesso:", socket.id);
  });
});

// ── Serve frontend statico ──────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// ── Avvio ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`☕ PausApp server in ascolto su http://localhost:${PORT}`);
});
