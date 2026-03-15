import {
  auth,
  db,
  storage,
  signInAnonymously,
  signOut,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  addDoc,
  serverTimestamp,
  arrayUnion,
  ref,
  uploadBytes,
  getDownloadURL,
  limit,
  orderBy,
} from "./firebase-config.js";
import { BrowserMultiFormatReader } from "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm";

const state = {
  activeView: "chats",
  user: null,
  scanner: null,
  scanControl: null,
  unsubscribers: [],
  cachedChats: [],
  cachedClubs: [],
  cachedLocations: [],
};

const els = {
  authView: document.getElementById("authView"),
  appView: document.getElementById("appView"),
  startScanBtn: document.getElementById("startScanBtn"),
  stopScanBtn: document.getElementById("stopScanBtn"),
  barcodePreview: document.getElementById("barcodePreview"),
  scanStatus: document.getElementById("scanStatus"),
  recoveryForm: document.getElementById("recoveryForm"),
  recoveryParkrunId: document.getElementById("recoveryParkrunId"),
  recoveryEmail: document.getElementById("recoveryEmail"),
  recoveryStatus: document.getElementById("recoveryStatus"),
  contentArea: document.getElementById("contentArea"),
  viewTitle: document.getElementById("viewTitle"),
  userSummary: document.getElementById("userSummary"),
  logoutBtn: document.getElementById("logoutBtn"),
  navButtons: [...document.querySelectorAll(".bottom-nav button")],
  badgeChats: document.getElementById("badgeChats"),
  badgeClubs: document.getElementById("badgeClubs"),
  badgeLocations: document.getElementById("badgeLocations"),
};

const stopListeners = () => {
  state.unsubscribers.forEach((fn) => fn());
  state.unsubscribers = [];
};

const setStatus = (node, text, isError = false) => {
  node.textContent = text;
  node.style.color = isError ? "#ea5a5a" : "";
};

const sanitizeId = (value) => value.trim().replace(/[^\w-]/g, "");

async function verifyAndLoginWithBarcode(barcodeRaw) {
  const barcodeID = sanitizeId(barcodeRaw);
  if (!barcodeID) throw new Error("Barcode unreadable.");

  await signInAnonymously(auth);
  const userRef = doc(db, "users", barcodeID);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      barcodeID,
      profileData: { displayName: `Runner ${barcodeID}`, homeParkrun: "Unknown" },
      clubs: [],
      locations: [],
      recoveryEmail: "",
      createdAt: serverTimestamp(),
    });
  } else {
    const data = snap.data();
    if (data.barcodeID !== barcodeID) throw new Error("Barcode verification failed.");
  }

  const currentSnap = await getDoc(userRef);
  state.user = { id: barcodeID, ...currentSnap.data() };
  onLoginSuccess();
}

function onLoginSuccess() {
  els.authView.classList.remove("active");
  els.appView.classList.add("active");
  els.userSummary.textContent = `Logged in as ${state.user.profileData?.displayName || state.user.id} (${state.user.id})`;
  connectRealtimeFeeds();
  renderCurrentView();
}

async function startBarcodeScanner() {
  if (!state.scanner) state.scanner = new BrowserMultiFormatReader();
  setStatus(els.scanStatus, "Requesting camera...");

  try {
    state.scanControl = await state.scanner.decodeFromVideoDevice(undefined, els.barcodePreview, async (result, err, controls) => {
      if (result) {
        controls.stop();
        setStatus(els.scanStatus, "Barcode detected. Verifying...");
        try {
          await verifyAndLoginWithBarcode(result.getText());
          setStatus(els.scanStatus, "Login success.");
        } catch (e) {
          setStatus(els.scanStatus, e.message, true);
        }
      }
      if (err && !String(err).includes("NotFoundException")) {
        setStatus(els.scanStatus, "Scanning error, try again.", true);
      }
    });
  } catch {
    setStatus(els.scanStatus, "Camera unavailable. Use a supported secure origin (https).", true);
  }
}

function stopBarcodeScanner() {
  if (state.scanControl?.stop) state.scanControl.stop();
  setStatus(els.scanStatus, "Scanner stopped.");
}

async function sendRecovery(event) {
  event.preventDefault();
  const parkrunID = sanitizeId(els.recoveryParkrunId.value);
  const recoveryEmail = els.recoveryEmail.value.trim().toLowerCase();
  if (!parkrunID || !recoveryEmail) return;

  const userRef = doc(db, "users", parkrunID);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return setStatus(els.recoveryStatus, "Account not found.", true);

  const data = snap.data();
  if (!data.recoveryEmail || data.recoveryEmail.toLowerCase() !== recoveryEmail) {
    return setStatus(els.recoveryStatus, "Recovery denied: email is not the verified ICE email.", true);
  }

  setStatus(els.recoveryStatus, "Recovery link request queued. Check your email inbox.");
}

function connectRealtimeFeeds() {
  stopListeners();
  const uid = state.user.id;

  const chatsQ = query(collection(db, "chats"), where("members", "array-contains", uid), limit(25));
  state.unsubscribers.push(onSnapshot(chatsQ, (snap) => {
    state.cachedChats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    els.badgeChats.textContent = String(state.cachedChats.length);
    if (state.activeView === "chats") renderChatsView();
  }));

  const clubsQ = query(collection(db, "clubs"), where("members", "array-contains", uid), limit(25));
  state.unsubscribers.push(onSnapshot(clubsQ, (snap) => {
    state.cachedClubs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    els.badgeClubs.textContent = String(state.cachedClubs.length);
    if (state.activeView === "clubs") renderClubsView();
  }));

  const locationsQ = query(collection(db, "locations"), where("members", "array-contains", uid), limit(25));
  state.unsubscribers.push(onSnapshot(locationsQ, (snap) => {
    state.cachedLocations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    els.badgeLocations.textContent = String(state.cachedLocations.length);
    if (state.activeView === "locations") renderLocationsView();
  }));
}

function renderCurrentView() {
  if (!state.user) return;
  els.navButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.view === state.activeView));
  if (state.activeView === "chats") return renderChatsView();
  if (state.activeView === "clubs") return renderClubsView();
  if (state.activeView === "locations") return renderLocationsView();
  renderProfileView();
}

function renderChatsView() {
  els.viewTitle.textContent = "Chats";
  els.contentArea.innerHTML = `
    <input id="chatSearch" class="inline-search" placeholder="Search by display name or parkrunID" />
    <div id="chatList" class="list"></div>
  `;
  const list = els.contentArea.querySelector("#chatList");
  const search = els.contentArea.querySelector("#chatSearch");

  const renderList = () => {
    const term = search.value.trim().toLowerCase();
    const filtered = state.cachedChats.filter((chat) => {
      const members = chat.members || [];
      return !term || members.some((m) => m.toLowerCase().includes(term));
    });
    list.innerHTML = filtered
      .map((chat) => `<button class="item chat-open" data-id="${chat.id}">${chat.type} • ${chat.members.join(", ")}</button>`)
      .join("") || `<p class="hint">No allowed chats yet.</p>`;

    list.querySelectorAll(".chat-open").forEach((btn) => {
      btn.addEventListener("click", () => openMessageFeed("chats", btn.dataset.id));
    });
  };

  search.addEventListener("input", renderList);
  renderList();
}

function renderClubsView() {
  els.viewTitle.textContent = "Clubs";
  const allowedClubs = state.cachedClubs.filter((club) => (club.members || []).includes(state.user.id));
  els.contentArea.innerHTML = `<div class="list">${allowedClubs
    .map((club) => `<button class="item club-open" data-id="${club.id}">${club.name || club.id}</button>`)
    .join("") || `<p class="hint">You do not belong to any verified club.</p>`}</div>`;

  els.contentArea.querySelectorAll(".club-open").forEach((btn) => {
    btn.addEventListener("click", () => openMessageFeed("clubs", btn.dataset.id));
  });
}

function renderLocationsView() {
  els.viewTitle.textContent = "Locations";
  const allowed = state.cachedLocations.filter((loc) => (loc.members || []).includes(state.user.id));
  els.contentArea.innerHTML = `<div class="list">${allowed
    .map((loc) => {
      const channels = ["general", "events", "volunteering", "results"];
      return `<div class="item"><strong>${loc.name || loc.id}</strong><div>${channels
        .map((channel) => `<button class="ghost location-open" data-id="${loc.id}" data-channel="${channel}">#${channel}</button>`)
        .join(" ")}</div></div>`;
    })
    .join("") || `<p class="hint">No verified locations assigned.</p>`}</div>`;

  els.contentArea.querySelectorAll(".location-open").forEach((btn) => {
    btn.addEventListener("click", () => openMessageFeed("locations", btn.dataset.id, btn.dataset.channel));
  });
}

function renderProfileView() {
  els.viewTitle.textContent = "Profile";
  const data = state.user.profileData || {};
  els.contentArea.innerHTML = `
    <div class="item">
      <h3>${data.displayName || "Runner"}</h3>
      <p>Parkrun ID: ${state.user.id}</p>
      <p>Home parkrun: ${data.homeParkrun || "Unknown"}</p>
      <p>Clubs: ${(state.user.clubs || []).length}</p>
      <p>Locations followed: ${(state.user.locations || []).length}</p>
      <form id="profileForm">
        <label>Recovery email
          <input type="email" id="profileRecoveryEmail" placeholder="verified@ice-mail.com" value="${state.user.recoveryEmail || ""}" />
        </label>
        <button>Update recovery email</button>
      </form>
    </div>
  `;

  els.contentArea.querySelector("#profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = els.contentArea.querySelector("#profileRecoveryEmail").value.trim().toLowerCase();
    await updateDoc(doc(db, "users", state.user.id), { recoveryEmail: email });
    state.user.recoveryEmail = email;
    alert("Recovery email updated.");
  });
}

function renderMessage(message) {
  const sentAt = message.timestamp?.toDate ? message.timestamp.toDate().toLocaleString() : "pending";
  const reactions = Object.entries(message.reactions || {})
    .map(([emoji, users]) => `${emoji} ${users.length}`)
    .join(" ");

  return `
    <article class="message" data-id="${message.id}">
      <div><strong>${message.senderID}</strong></div>
      <div>${message.content || ""}</div>
      ${message.imageURL ? `<img src="${message.imageURL}" alt="uploaded image" />` : ""}
      ${reactions ? `<div>${reactions}</div>` : ""}
      <div class="meta">${sentAt} • ${message.type || "text"}</div>
      <button class="ghost react-btn" data-message="${message.id}">+😀</button>
    </article>
  `;
}

function buildThreadRef(scope, id, channel = "general") {
  if (scope === "chats") return collection(db, "chats", id, "messages");
  if (scope === "clubs") return collection(db, "clubs", id, "chat", "messages");
  return collection(db, "locations", id, "channels", channel, "messages");
}

function canWriteTo(scope, contextDoc, channel) {
  if (scope === "locations" && channel === "results") return false;
  if (scope === "chats") return (contextDoc.members || []).includes(state.user.id);
  if (scope === "clubs") return (contextDoc.members || []).includes(state.user.id);
  return (contextDoc.members || []).includes(state.user.id);
}

async function openMessageFeed(scope, id, channel = "general") {
  const contextDoc =
    scope === "chats"
      ? state.cachedChats.find((x) => x.id === id)
      : scope === "clubs"
      ? state.cachedClubs.find((x) => x.id === id)
      : state.cachedLocations.find((x) => x.id === id);

  if (!contextDoc || !(contextDoc.members || []).includes(state.user.id)) {
    return alert("Access denied for this conversation.");
  }

  const writable = canWriteTo(scope, contextDoc, channel);
  els.contentArea.innerHTML = `<div class="chat-window"><div id="messageList" class="messages"></div><div id="composerSlot"></div></div>`;

  const composerSlot = els.contentArea.querySelector("#composerSlot");
  if (!writable) {
    composerSlot.innerHTML = `<p class="readonly-note">#results is read-only and auto-updated by trusted services.</p>`;
  } else {
    const tpl = document.getElementById("messageComposerTpl");
    composerSlot.appendChild(tpl.content.cloneNode(true));
    const form = composerSlot.querySelector("form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = form.message.value.trim();
      const imageFile = form.image.files?.[0] || null;
      if (!message && !imageFile) return;
      await sendMessage(scope, id, channel, message, imageFile);
      form.reset();
    });
  }

  const messagesQ = query(buildThreadRef(scope, id, channel), orderBy("timestamp", "asc"), limit(100));
  const unsub = onSnapshot(messagesQ, (snap) => {
    const msgList = els.contentArea.querySelector("#messageList");
    const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    msgList.innerHTML = messages.map(renderMessage).join("");
    msgList.scrollTop = msgList.scrollHeight;

    msgList.querySelectorAll(".react-btn").forEach((btn) => {
      btn.addEventListener("click", () => addReaction(scope, id, channel, btn.dataset.message, "😀"));
    });
  });
  state.unsubscribers.push(unsub);
}

async function sendMessage(scope, id, channel, text, imageFile) {
  const contextDoc =
    scope === "chats"
      ? state.cachedChats.find((x) => x.id === id)
      : scope === "clubs"
      ? state.cachedClubs.find((x) => x.id === id)
      : state.cachedLocations.find((x) => x.id === id);

  if (!contextDoc || !canWriteTo(scope, contextDoc, channel)) throw new Error("Write blocked by permission rules.");

  let imageURL = "";
  if (imageFile) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(imageFile.type) || imageFile.size > 3 * 1024 * 1024) {
      throw new Error("Invalid image type or size exceeds 3MB.");
    }
    const path = `uploads/${scope}/${id}/${Date.now()}-${imageFile.name}`;
    const imageRef = ref(storage, path);
    await uploadBytes(imageRef, imageFile, { contentType: imageFile.type });
    imageURL = await getDownloadURL(imageRef);
  }

  await addDoc(buildThreadRef(scope, id, channel), {
    senderID: state.user.id,
    content: text,
    timestamp: serverTimestamp(),
    type: imageURL ? "image" : "text",
    imageURL,
    reactions: {},
  });
}

async function addReaction(scope, id, channel, messageID, emoji) {
  const msgRef = doc(buildThreadRef(scope, id, channel), messageID);
  await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(state.user.id) });
}

async function logout() {
  stopBarcodeScanner();
  stopListeners();
  state.user = null;
  await signOut(auth);
  els.appView.classList.remove("active");
  els.authView.classList.add("active");
}

els.startScanBtn.addEventListener("click", startBarcodeScanner);
els.stopScanBtn.addEventListener("click", stopBarcodeScanner);
els.recoveryForm.addEventListener("submit", sendRecovery);
els.logoutBtn.addEventListener("click", logout);
els.navButtons.forEach((btn) => btn.addEventListener("click", () => {
  state.activeView = btn.dataset.view;
  renderCurrentView();
}));
