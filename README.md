# Parkrun Chat App

Real-time parkrun chat prototype built with HTML/CSS/JavaScript + Firebase.

## Files

- `index.html` - app layout, auth screen, nav, and chat template.
- `style.css` - responsive UI styles.
- `app.js` - auth flow, barcode scanning, real-time listeners, messaging UI.
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

chats/{chatID}/messages/{messageID}:
  senderID
  content
  timestamp
  type: "text|image|reaction"
  imageURL
  reactions

locations/{locationID}:
  members: [userIDs]
  channels: {
    general, events, volunteering, results
  }

clubs/{clubID}:
  members: [userIDs]
  chat/messages
```

## Security notes

- Barcode value is sanitized and checked against `users/{barcodeID}.barcodeID` before session login is accepted.
- Recovery path only succeeds when entered email matches stored verified `recoveryEmail`.
- Query scopes use membership filters (`array-contains`) and UI re-checks membership before opening thread.
- `#results` location channel is intentionally read-only in UI and write-blocked by `canWriteTo` guard.
- Add matching Firestore/Storage security rules server-side before production.
