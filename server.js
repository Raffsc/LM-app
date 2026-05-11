const express  = require("express");
const http     = require("http");
const { Server } = require("socket.io");
const path     = require("path");
const webpush  = require("web-push");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: "*" } });

app.use(express.json());

// ── VAPID — chiavi per le notifiche push ────────────────────────────────────
// Queste chiavi identificano il tuo server. Non condividerle.
const VAPID_PUBLIC_KEY  = "BHNZKeiJ8GzCX-cm5S-xAGRSHQ2EumolaPX5TVfLrVgHEQU_Zl1w5ohmrikVcwlqC3YjCcd_KCOyBjvjXDw3l6E";
const VAPID_PRIVATE_KEY = "7ll0vAfofBGxcwLoy5A30USOHTwn7mSLQCzKSJzHAEw";

webpush.setVapidDetails(
  "mailto:pausapp@team.it",   // email di contatto (può essere qualsiasi)
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ── Subscriptions — salva le iscrizioni push di ogni utente ────────────────
// { "Alexxx": { endpoint, keys... }, "Enzos": {...}, ... }
let pushSubscriptions = {};

// ── Stato condiviso in memoria ──────────────────────────────────────────────
let state = {
  breakCaller: null,
  breakTime:   null,
  secondsLeft: 0,
  joiners:     [],
  message:     "",
  history:     [],
};

let timerInterval   = null;
const BREAK_DURATION = 15 * 60;
const MESSAGES = [
  "☕ Coffee Break Brothers!",
  "🧘 Eeee Bbbast!",
  "🚶 LM, liev 'man!",
  "🍵 Uagliù LM!",
  "😌 MO' BAST, LM!",
];

// ── Manda notifica push a tutti gli utenti iscritti ────────────────────────
function pushToAll(title, body, tag, excludeUser) {
  Object.entries(pushSubscriptions).forEach(function([user, subscription]) {
    if (user === excludeUser) return; // non notificare chi ha chiamato l'azione
    const payload = JSON.stringify({ title, body, tag: tag || "pausapp" });
    webpush.sendNotification(subscription, payload)
      .catch(function(err) {
        // Se la subscription non è più valida (utente ha revocato), la rimuoviamo
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log("🗑 Subscription scaduta per:", user);
          delete pushSubscriptions[user];
        } else {
          console.log("❌ Push error per", user, ":", err.message);
        }
      });
  });
}

function broadcast() {
  io.emit("state", state);
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(function() {
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
      { caller: state.breakCaller, time: state.breakTime, joiners: [...state.joiners] },
      ...state.history.slice(0, 4),
    ];
    // Notifica push a tutti: pausa terminata
    pushToAll("💻 Pausa terminata", "Si torna al lavoro!", "break-end", null);
  }
  state.breakCaller = null;
  state.breakTime   = null;
  state.secondsLeft = 0;
  state.joiners     = [];
  state.message     = "";
  broadcast();
}

// ── REST endpoint: salva la subscription push dell'utente ──────────────────
app.post("/subscribe", function(req, res) {
  const { user, subscription } = req.body;
  if (!user || !subscription) return res.status(400).json({ error: "Dati mancanti" });
  pushSubscriptions[user] = subscription;
  console.log("🔔 Push subscription salvata per:", user);
  res.json({ ok: true });
});

// ── REST endpoint: restituisce la chiave pubblica VAPID al frontend ─────────
app.get("/vapid-public-key", function(req, res) {
  res.json({ key: VAPID_PUBLIC_KEY });
});

// ── WebSocket events ────────────────────────────────────────────────────────
io.on("connection", function(socket) {
  console.log("✅ Client connesso:", socket.id);
  socket.emit("state", state);

  socket.on("callBreak", function({ user }) {
    if (state.breakCaller) return;
    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    state.breakCaller = user;
    state.breakTime   = new Date().toISOString();
    state.secondsLeft = BREAK_DURATION;
    state.joiners     = [user];
    state.message     = msg;
    broadcast();
    startTimer();
    // Notifica push a tutti tranne chi ha chiamato la pausa
    pushToAll("☕ " + user + " ha chiamato la pausa!", msg, "break-start", user);
  });

  socket.on("joinBreak", function({ user }) {
    if (!state.breakCaller) return;
    if (!state.joiners.includes(user)) {
      state.joiners.push(user);
      broadcast();
      // Notifica push agli altri che qualcuno si è unito
      pushToAll("☕ " + user + " si è unito!", "Altro caffè in arrivo!", "join", user);
    }
  });

  socket.on("endBreak", function() {
    endBreak();
  });

  socket.on("disconnect", function() {
    console.log("❌ Client disconnesso:", socket.id);
  });
});

// ── Serve frontend statico ──────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.get("*", function(_, res) {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Avvio ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, function() {
  console.log("☕ PausApp server in ascolto su http://localhost:" + PORT);
});
