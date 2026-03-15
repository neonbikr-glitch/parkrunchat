# parkrunchat

A client-side blueprint implementation of a parkrun chat app with Firebase-ready schema names and permission-oriented checks.

## Files

- `index.html`: App layout (auth flow, chat/club/location/profile panes, composer, bottom navigation).
- `style.css`: Responsive mobile-first styles.
- `firebase-config.js`: Firebase config placeholders plus canonical schema/session constants.
- `app.js`: Session management, barcode login simulation, membership checks, read-only `#results`, and messaging logic.

## Run locally

Open `index.html` directly or with a static file server.

## Firebase integration notes

1. Replace placeholders in `firebase-config.js` with real config.
2. Wire Firestore snapshot listeners for real-time sync on:
   - chats where `members` contains current user,
   - clubs where `members` contains current user,
   - locations where user is a member.
3. Enforce equivalent checks in Firestore Security Rules:
   - users may only read/write their own `users/{userID}` doc,
   - chat writes require sender membership,
   - club chat writes require club membership,
   - location `channels.results` must be server-controlled/read-only.
