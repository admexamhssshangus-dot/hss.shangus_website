// Netlify Function: save-config
// Writes slides files back to the Git repo using GitHub Contents API.
// Required environment variables in Netlify:
// - GITHUB_TOKEN: Personal access token with repo contents scope
// - GITHUB_REPO: owner/repo (e.g. myorg/myrepo)
// - GITHUB_BRANCH: branch to commit to (e.g. main)
// - SAVE_SECRET: a secret string used to authenticate requests from the frontend

const GITHUB_API = 'https://api.github.com';

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const secretHeader = event.headers['x-save-secret'] || event.headers['X-Save-Secret'];
  if (!secretHeader || secretHeader !== process.env.SAVE_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token || !repo) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured: missing GITHUB_TOKEN or GITHUB_REPO' }) };
  }

  const files = [
    { path: 'public/slides/settings.json', content: JSON.stringify(payload.settings || {}, null, 2) },
    { path: 'public/slides/notices.txt', content: (payload.noticesText || '') },
    { path: 'public/slides/faculty.json', content: JSON.stringify((payload.faculty || []).map(({ id, ...r }) => r), null, 2) },
    { path: 'public/slides/admins.json', content: JSON.stringify(payload.admins || [], null, 2) }
  ];

  const results = [];

  for (const file of files) {
    try {
      // Fetch existing file sha (if any)
      const getRes = await fetch(`${GITHUB_API}/repos/${repo}/contents/${encodeURIComponent(file.path)}?ref=${encodeURIComponent(branch)}`, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
      });

      let sha = null;
      if (getRes.status === 200) {
        const j = await getRes.json();
        sha = j.sha;
      }

      const putBody = {
        message: `Auto-update slides: ${file.path}`,
        content: Buffer.from(file.content, 'utf8').toString('base64'),
        branch
      };
      if (sha) putBody.sha = sha;

      const putRes = await fetch(`${GITHUB_API}/repos/${repo}/contents/${encodeURIComponent(file.path)}`, {
        method: 'PUT',
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody)
      });

      if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        results.push({ path: file.path, ok: false, error: err });
      } else {
        const j = await putRes.json();
        results.push({ path: file.path, ok: true, commit: j.commit && j.commit.sha });
      }
    } catch (e) {
      results.push({ path: file.path, ok: false, error: String(e) });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ results })
  };
};
