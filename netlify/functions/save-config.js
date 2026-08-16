/**
 * Deliberately disabled.
 *
 * A static React bundle cannot safely hold a shared secret capable of writing
 * to a GitHub repository. Configuration changes must go through Firestore with
 * verified admin custom claims, or through an authenticated CI/admin backend.
 */
exports.handler = async function handler() {
  return {
    statusCode: 410,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
    body: JSON.stringify({ error: 'Remote repository configuration writes are disabled.' }),
  };
};
