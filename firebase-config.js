// Replace with your Firebase project config before deployment.
export const firebaseAppConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME'
};

// Canonical Firestore field names used by the client.
export const schema = {
  users: {
    barcodeID: 'barcodeID',
    profileData: 'profileData',
    clubs: 'clubs',
    locations: 'locations',
    recoveryEmail: 'recoveryEmail'
  },
  chats: {
    type: 'type',
    members: 'members',
    messages: 'messages'
  },
  locations: {
    channels: 'channels',
    achievements: 'achievements',
    readOnly: 'readOnly'
  },
  clubs: {
    members: 'members',
    chat: 'chat'
  }
};

export const sessionConfig = {
  maxSessionMs: 30 * 60 * 1000,
  maxImageSizeBytes: 2 * 1024 * 1024,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp']
};
