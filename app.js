import { schema, sessionConfig } from './firebase-config.js';

const state = {
  currentUserId: null,
  sessionStartedAt: 0,
  activePane: 'chatsPane',
  activeLocation: null,
  activeChannel: 'general',
  activeContext: { type: 'chat', id: null },
  db: {
    users: {
      U10001: {
        barcodeID: 'A123456',
        profileData: { name: 'Mia Runner', homeParkrun: 'Park South', stats: '112 runs' },
        clubs: ['c25'],
        locations: ['park-south'],
        recoveryEmail: 'mia@example.com'
      },
      U10002: {
        barcodeID: 'A654321',
        profileData: { name: 'Leo Pace', homeParkrun: 'River Run', stats: '42 runs' },
        clubs: ['c25'],
        locations: ['park-south'],
        recoveryEmail: 'leo@example.com'
      }
    },
    chats: {
      chat-1: {
        type: 'private',
        members: ['U10001', 'U10002'],
        messages: [{ senderID: 'U10002', content: 'See you Saturday!', timestamp: Date.now() - 1000, type: 'text' }]
      }
    },
    locations: {
      'park-south': {
        channels: {
          general: { messages: [{ senderID: 'U10002', content: 'Course is dry today.', timestamp: Date.now() - 2000, type: 'text' }] },
          events: { messages: [] },
          volunteering: { messages: [] },
          results: { achievements: [{ runner: 'Mia Runner', note: 'PB 24:01' }], readOnly: true }
        }
      }
    },
    clubs: {
      c25: {
        members: ['U10001', 'U10002'],
        chat: { messages: [{ senderID: 'U10001', content: 'Welcome to 25 Club! 🎉', timestamp: Date.now() - 5000, type: 'text' }] }
      }
    }
  }
};

const el = {
  authView: document.getElementById('authView'),
  appView: document.getElementById('appView'),
  status: document.getElementById('sessionStatus'),
  barcodeInput: document.getElementById('barcodeInput'),
  simulateScanBtn: document.getElementById('simulateScanBtn'),
  recoveryIdInput: document.getElementById('recoveryIdInput'),
  recoveryBtn: document.getElementById('recoveryBtn'),
  chatSearch: document.getElementById('chatSearch'),
  chatList: document.getElementById('chatList'),
  clubList: document.getElementById('clubList'),
  refreshClubsBtn: document.getElementById('refreshClubsBtn'),
  locationSelector: document.getElementById('locationSelector'),
  channelSelector: document.getElementById('channelSelector'),
  locationMessageList: document.getElementById('locationMessageList'),
  profileData: document.getElementById('profileData'),
  messageInput: document.getElementById('messageInput'),
  imageInput: document.getElementById('imageInput'),
  sendBtn: document.getElementById('sendBtn'),
  chatBadge: document.getElementById('chatBadge'),
  clubBadge: document.getElementById('clubBadge'),
  locationBadge: document.getElementById('locationBadge')
};

function isSessionValid() {
  return state.currentUserId && Date.now() - state.sessionStartedAt < sessionConfig.maxSessionMs;
}

function requireSession() {
  if (!isSessionValid()) {
    logout('Session expired. Please rescan your barcode.');
    return false;
  }
  return true;
}

function loginWithBarcode(barcodeID) {
  const normalized = barcodeID.trim().toUpperCase();
  if (!normalized) return;

  const existing = Object.entries(state.db.users).find(([, user]) => user[schema.users.barcodeID] === normalized);

  if (existing) {
    state.currentUserId = existing[0];
  } else {
    const userID = `U${Math.floor(Math.random() * 90000 + 10000)}`;
    state.db.users[userID] = {
      barcodeID: normalized,
      profileData: { name: `Runner ${normalized}`, homeParkrun: 'Unassigned', stats: '0 runs' },
      clubs: [],
      locations: [],
      recoveryEmail: ''
    };
    state.currentUserId = userID;
  }

  state.sessionStartedAt = Date.now();
  el.authView.classList.remove('active');
  el.appView.classList.add('active');
  el.status.textContent = `Logged in as ${state.currentUserId}`;
  hydrateUI();
}

function logout(message) {
  state.currentUserId = null;
  state.sessionStartedAt = 0;
  el.authView.classList.add('active');
  el.appView.classList.remove('active');
  el.status.textContent = message || 'Not logged in';
}

function allowedChats() {
  return Object.entries(state.db.chats).filter(([, chat]) => chat[schema.chats.members].includes(state.currentUserId));
}

function allowedClubs() {
  return Object.entries(state.db.clubs).filter(([, club]) => club[schema.clubs.members].includes(state.currentUserId));
}

function allowedLocations() {
  const user = state.db.users[state.currentUserId];
  return user[schema.users.locations].filter((id) => state.db.locations[id]);
}

function renderChats(filter = '') {
  const q = filter.trim().toLowerCase();
  const chats = allowedChats().filter(([, chat]) => {
    const otherMembers = chat.members.filter((id) => id !== state.currentUserId).map((id) => state.db.users[id]);
    if (!q) return true;
    return otherMembers.some((u) =>
      u?.profileData?.name?.toLowerCase().includes(q) || u?.barcodeID?.toLowerCase().includes(q)
    );
  });

  el.chatList.innerHTML = '';
  chats.forEach(([chatID, chat]) => {
    const li = document.createElement('li');
    const recent = chat.messages.at(-1);
    li.innerHTML = `<strong>${chat.type} (${chatID})</strong><br>${recent?.content || 'No messages yet'}`;
    li.onclick = () => {
      state.activeContext = { type: 'chat', id: chatID };
      updateComposerState();
    };
    el.chatList.append(li);
  });

  el.chatBadge.textContent = String(chats.length);
}

function renderClubs() {
  const clubs = allowedClubs();
  el.clubList.innerHTML = '';
  clubs.forEach(([clubID, club]) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${clubID}</strong><br>${club.chat.messages.at(-1)?.content || 'No activity'}`;
    li.onclick = () => {
      state.activeContext = { type: 'club', id: clubID };
      updateComposerState();
    };
    el.clubList.append(li);
  });

  el.clubBadge.textContent = String(clubs.length);
}

function renderLocations() {
  const locations = allowedLocations();
  if (!state.activeLocation && locations.length) state.activeLocation = locations[0];
  el.locationSelector.innerHTML = '';

  locations.forEach((locationID) => {
    const option = document.createElement('option');
    option.value = locationID;
    option.textContent = locationID;
    option.selected = locationID === state.activeLocation;
    el.locationSelector.append(option);
  });

  el.locationBadge.textContent = String(locations.length);
  renderLocationMessages();
}

function renderLocationMessages() {
  el.locationMessageList.innerHTML = '';
  if (!state.activeLocation) return;

  const location = state.db.locations[state.activeLocation];
  const channel = state.activeChannel;

  if (channel === 'results') {
    location.channels.results.achievements.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = `${item.runner}: ${item.note}`;
      el.locationMessageList.append(li);
    });
    state.activeContext = { type: 'location', id: state.activeLocation };
    updateComposerState();
    return;
  }

  const messages = location.channels[channel].messages;
  messages.forEach((m) => {
    const li = document.createElement('li');
    li.textContent = `${m.senderID}: ${m.content}`;
    el.locationMessageList.append(li);
  });

  state.activeContext = { type: 'location', id: state.activeLocation };
  updateComposerState();
}

function renderProfile() {
  const user = state.db.users[state.currentUserId];
  el.profileData.innerHTML = `
    <dt>Name</dt><dd>${user.profileData.name}</dd>
    <dt>Home parkrun</dt><dd>${user.profileData.homeParkrun}</dd>
    <dt>Stats</dt><dd>${user.profileData.stats}</dd>
    <dt>Recovery Email</dt><dd>${user.recoveryEmail || 'Not set'}</dd>
    <dt>Barcode ID</dt><dd>${user.barcodeID}</dd>
  `;
}

function updateComposerState() {
  const readOnlyResults = state.activePane === 'locationsPane' && state.activeChannel === 'results';
  el.messageInput.disabled = readOnlyResults;
  el.imageInput.disabled = readOnlyResults;
  el.sendBtn.disabled = readOnlyResults;
  el.messageInput.placeholder = readOnlyResults ? '#results is read-only and server-updated.' : 'Type a message';
}

function hydrateUI() {
  renderChats();
  renderClubs();
  renderLocations();
  renderProfile();
  switchPane(state.activePane);
}

function canPostToActiveContext() {
  if (state.activePane === 'locationsPane' && state.activeChannel === 'results') {
    return false;
  }

  if (state.activeContext.type === 'chat') {
    const chat = state.db.chats[state.activeContext.id];
    return chat?.members.includes(state.currentUserId);
  }

  if (state.activeContext.type === 'club') {
    const club = state.db.clubs[state.activeContext.id];
    return club?.members.includes(state.currentUserId);
  }

  if (state.activeContext.type === 'location') {
    return allowedLocations().includes(state.activeLocation);
  }

  return false;
}

function validateImage(file) {
  if (!file) return { ok: true };
  if (!sessionConfig.allowedImageTypes.includes(file.type)) {
    return { ok: false, message: 'Only JPEG/PNG/WEBP images are allowed.' };
  }
  if (file.size > sessionConfig.maxImageSizeBytes) {
    return { ok: false, message: 'Image exceeds size limit (2MB).' };
  }
  return { ok: true };
}

function appendMessage(content, type = 'text') {
  if (!requireSession()) return;
  if (!canPostToActiveContext()) {
    alert('You do not have permission to post in this chat/channel.');
    return;
  }

  const message = { senderID: state.currentUserId, content, timestamp: Date.now(), type };
  const context = state.activeContext;

  if (context.type === 'chat') {
    state.db.chats[context.id].messages.push(message);
    renderChats(el.chatSearch.value);
  } else if (context.type === 'club') {
    state.db.clubs[context.id].chat.messages.push(message);
    renderClubs();
  } else if (context.type === 'location') {
    state.db.locations[state.activeLocation].channels[state.activeChannel].messages.push(message);
    renderLocationMessages();
  }

  el.messageInput.value = '';
  el.locationMessageList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function sendMessage() {
  const content = el.messageInput.value.trim();
  const imageFile = el.imageInput.files[0];
  const imageValidation = validateImage(imageFile);

  if (!imageValidation.ok) {
    alert(imageValidation.message);
    return;
  }

  if (content) appendMessage(content, 'text');
  if (imageFile) appendMessage(`[image] ${imageFile.name}`, 'image');
  el.imageInput.value = '';
}

function switchPane(paneId) {
  state.activePane = paneId;
  document.querySelectorAll('.pane').forEach((pane) => pane.classList.toggle('active', pane.id === paneId));
  document.querySelectorAll('.bottom-nav button').forEach((btn) => btn.classList.toggle('active', btn.dataset.pane === paneId));
  updateComposerState();
}

function sendRecoveryEmail() {
  const barcodeID = el.recoveryIdInput.value.trim().toUpperCase();
  const user = Object.values(state.db.users).find((item) => item.barcodeID === barcodeID);
  if (!user) {
    alert('No account found for that parkrun ID.');
    return;
  }
  if (!user.recoveryEmail) {
    alert('Recovery unavailable because no verified ICE email is stored.');
    return;
  }
  alert(`Recovery email sent to ${user.recoveryEmail}.`);
}

el.simulateScanBtn.addEventListener('click', () => loginWithBarcode(el.barcodeInput.value));
el.recoveryBtn.addEventListener('click', sendRecoveryEmail);
el.chatSearch.addEventListener('input', () => renderChats(el.chatSearch.value));
el.refreshClubsBtn.addEventListener('click', renderClubs);
el.locationSelector.addEventListener('change', (event) => {
  state.activeLocation = event.target.value;
  renderLocationMessages();
});
el.channelSelector.addEventListener('change', (event) => {
  state.activeChannel = event.target.value;
  renderLocationMessages();
});
el.sendBtn.addEventListener('click', sendMessage);
document.querySelectorAll('.bottom-nav button').forEach((btn) => {
  btn.addEventListener('click', () => switchPane(btn.dataset.pane));
});

window.addEventListener('DOMContentLoaded', () => {
  el.status.textContent = 'Scan barcode to start secure session.';
});
