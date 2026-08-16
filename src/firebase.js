// Compatibility entry point for older public-site imports.
// All Firebase products must come from the single initialized app in
// services/firebase; initializing a second default app breaks Firestore during
// Fast Refresh and can create inconsistent Auth/Storage instances.
export {
  default,
  auth,
  db,
  functions,
  googleProvider,
  storage,
} from './services/firebase';
