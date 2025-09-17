  const admin = require("firebase-admin");

let initialized = false;

function ensureFirebaseAdmin() {
  // Lazy require to avoid hard dependency when not used
  // eslint-disable-next-line global-require
  if (initialized || admin.apps.length) return admin;

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL } = process.env;
  let { FIREBASE_PRIVATE_KEY } = process.env;

  try {
    if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
      // Handle escaped newlines in env
      if (FIREBASE_PRIVATE_KEY.includes("\\n")) {
        FIREBASE_PRIVATE_KEY = FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY,
        }),
      });
      initialized = true;
      return admin;
    }

    // Fallback to GOOGLE_APPLICATION_CREDENTIALS file if present
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp();
      initialized = true;
      return admin;
    }

    // If we reach here, not configured
    console.warn(
      "Firebase Admin SDK not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS."
    );
    return admin; // Return admin even if uninitialized to avoid crashes; callers should handle
  } catch (e) {
    console.error("Failed to initialize Firebase Admin:", e?.message || e);
    throw e;
  }
}

module.exports = { ensureFirebaseAdmin };
