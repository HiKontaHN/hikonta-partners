import { getApps, initializeApp } from "firebase/app";
import { getAuth, inMemoryPersistence, setPersistence, signOut } from "firebase/auth";

// Mismo proyecto de Firebase que yelifin-sistema (HiKonta) — los
// coordinadores de partner son usuarios normales de Firebase, vinculados
// a la tabla `partners` vía `partners.user_id` en vez de `organization_members`.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

// La sesión durable vive exclusivamente en la cookie httpOnly del servidor.
// También elimina cualquier persistencia del SDK dejada por versiones previas.
export const authReady = typeof window === "undefined"
  ? Promise.resolve()
  : setPersistence(auth, inMemoryPersistence).then(() => signOut(auth));

export { auth };
