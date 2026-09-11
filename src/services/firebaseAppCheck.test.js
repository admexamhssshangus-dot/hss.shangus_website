jest.mock('firebase/app-check', () => ({
  initializeAppCheck: jest.fn(() => ({ initialized: true })),
  ReCaptchaEnterpriseProvider: jest.fn(),
}));

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
  delete window.FIREBASE_APPCHECK_DEBUG_TOKEN;
});

test.each([
  ['development', 'true', 'registered-workstation-token'],
  ['development', 'false', undefined],
  ['production', 'true', undefined],
])('debug attestation respects %s mode and opt-in %s', (mode, enabled, expected) => {
  jest.resetModules();
  process.env.NODE_ENV = mode;
  process.env.REACT_APP_RECAPTCHA_ENTERPRISE_SITE_KEY = 'public-test-key';
  process.env.REACT_APP_ENABLE_APPCHECK_DEBUG = enabled;
  process.env.REACT_APP_APPCHECK_DEBUG_TOKEN = 'registered-workstation-token';
  const { initializeFirebaseAppCheck } = require('./firebaseAppCheck');
  initializeFirebaseAppCheck({});
  expect(window.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(expected);
});
