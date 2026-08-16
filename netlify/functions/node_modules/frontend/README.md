# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

## Manual deploy & Firebase workflow (current)

Summary
- This project is a standard CRA frontend that can be deployed two ways:
	- Git-based continuous deploy (Netlify builds from Git pushes).
	- Manual CLI deploy (we have been using `netlify deploy` from this machine).
- Important: Manual CLI deploys upload the contents of the `build/` folder directly to Netlify and do NOT change or require any new Git commit. Git remains your source of truth but Netlify's production snapshot can diverge from the last Git-based CI build if you deploy via CLI.

Prevent automatic deploys
- To avoid unexpected builds, disable automatic builds in Netlify (recommended):
	1. Open Netlify → Site → Site settings → Build & deploy → Continuous Deployment.
 2. Under "Build settings" or repository settings, disable "Auto publish" or unlink the Git repo.
 3. Alternatively use the Netlify UI to pause builds or remove the Git integration.

Manual deploy (how-to)
1. Build locally:
```
npm run build
```
2. Deploy the `build/` folder (linked site) with the Netlify CLI:
```
netlify deploy --prod --dir=build --message "Deploy latest local build"
```
If your folder is not linked to a site, link first (or pass `--site <SITE_ID>`):
```
netlify link
netlify deploy --site <SITE_ID> --prod --dir=build
```

Why Git may not reflect deployed files
- `git push` triggers a CI build only if Netlify is configured with Git integration. When you deploy with `netlify deploy` the built artifacts are uploaded directly and the deploy's snapshot can differ from the Git-based build.

Firebase checklist (verify these to ensure admin changes reflect to all users)
1. Firestore (real-time content storage)
	- Console: open Firebase Console → Firestore Database → Default. Verify documents exist under the `site` collection (documents: `settings`, `notices`, `faculty`, `admins`).
	- When AdminPortal saves, these docs should update. If they don't, check the browser console for errors and `onAuthStateChanged` / token claims.

2. Storage (uploaded photos/files)
	- Console: Firebase Console → Storage. If the project shows a message "To use Storage, upgrade your project's pricing plan", then Storage requires upgrading (Blaze) for production uploads. On Spark plan uploads may be restricted.
	- Confirm uploaded files appear under `slides/photos/` (or configured path) and are publicly-readable (check Storage rules and file permissions).

3. Authentication and admin gating
	- Console: Firebase Console → Authentication → Sign-in methods. Ensure Google sign-in is enabled if AdminPortal uses it.
	- Admin writes are permitted either by custom claim `admin:true` or by checking `site/admins` doc. To set a custom claim run the helper script below.

4. Security rules
	- Check `firebase.rules` in repo. Deploy rules with the Firebase CLI:
```
npx -y firebase-tools@latest deploy --only firestore:rules,storage:rules
```

5. Setting `admin:true` (server-side)
	- Use the helper script (requires a service account JSON with proper IAM):
```
node scripts/set_admin_claim.js /path/to/serviceAccount.json adm.exam.hss.shangus@gmail.com
```
	- The above sets a custom claim so `getIdTokenResult(user).claims.admin === true` becomes true for that user.

How to verify admin updates reached Firestore/Storage
1. In AdminPortal, make a change (e.g., update notices) and `Save`.
2. In Firebase Console → Firestore, open `site/notices` — check `update time` and content.
3. For uploaded photos, open Storage and confirm file present and `getDownloadURL` works.
4. In a separate browser (Incognito) or different device, open https://hssshangus.netlify.app and verify changes appear. If not, clear cache and unregister any service worker in DevTools → Application.

Useful local commands
- Build:
```
npm run build
```
- Local Netlify deploy (production):
```
netlify deploy --prod --dir=build --message "Deploy local build"
```
- Set Firebase rules:
```
npx -y firebase-tools@latest deploy --only firestore:rules,storage:rules
```
- Set admin claim (service account required):
```
node scripts/set_admin_claim.js /path/to/serviceAccount.json you@example.com
```

Notes & recommendations
- If you want every deploy to be controlled, either remove the Git integration in Netlify or enable notifications + require manual approval for builds. The simplest: unlink the repo in Netlify and only deploy via CLI from authorized machines.
- Keep Git as the source-of-truth: continue committing and pushing code so you can recover earlier versions.
- If your Firebase Storage shows an upgrade prompt, consider enabling Blaze plan for production uploads or adjust the app to avoid Storage for large uploads.

If you want, I can:
- Disable Netlify automatic deploys (I can unlink the repo via CLI or walk you through the UI).
- Run `node scripts/set_admin_claim.js` here if you provide the path to your service account JSON and the admin email.
- Deploy `firebase.rules` (requires Firebase CLI login / project access) — tell me if you want me to run these from this machine.

