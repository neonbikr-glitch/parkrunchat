# Parkrun Chat App (Main)

This repository now contains the **main** web implementation for the Parkrun Chat prototype.

Real-time parkrun chat prototype built with HTML/CSS/JavaScript + Firebase.

## Files

- `index.html` - app layout, auth screen, nav, and chat template.
- `style.css` - responsive UI styles.
- `app.js` - auth flow, barcode scanning, session restore/expiry, membership-gated feeds, messaging UI.
- `firebase-config.js` - Firebase initialization + exports.

## Setup

1. Create a Firebase project (Firestore + Auth + Storage enabled).
2. Replace `REPLACE_ME` values in `firebase-config.js`.
3. Serve locally (for modules + camera access):
   ```bash
   python3 -m http.server 4173
   ```
4. Open `http://localhost:4173`.

## Firestore schema (expected)

```text
users/{userID}:
  barcodeID
  profileData
  clubs: []
  locations: []
  recoveryEmail

chats/{chatID}:
  type: "private" | "group"
  members: [userIDs]
  messages: [{senderID, content, timestamp, type, imageURL}]

locations/{locationID}:
  members: [userIDs]
  channels: {
    general: { messages: [...] },
    events: { messages: [...] },
    volunteering: { messages: [...] },
    results: { achievements: [...], readOnly: true }
  }

clubs/{clubID}:
  members: [userIDs]
  chat: { messages: [...] }
```

## Security notes

- Barcode value is sanitized and checked against `users/{barcodeID}.barcodeID` before session login is accepted.
- Barcode session has local expiry and is removed on timeout/logout.
- Recovery path only succeeds when entered email matches stored verified `recoveryEmail`.
- Query scopes use membership filters (`array-contains`) and UI re-checks membership before opening a thread.
- `#results` channel is rendered read-only and write-blocked by permission checks.
- Add matching Firestore/Storage security rules server-side before production.
