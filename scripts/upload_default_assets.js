const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const svcPath = './scripts/serviceAccount.json';
if (!fs.existsSync(svcPath)) {
  console.error('serviceAccount.json not found');
  process.exit(1);
}
const serviceAccount = require(path.resolve(svcPath));
const projectId = serviceAccount.project_id || 'hsssdb';
const storageBucket = `${projectId}.firebasestorage.app`;

console.log('Initializing Firebase Admin SDK...');
console.log('Project ID:', projectId);
console.log('Storage Bucket:', storageBucket);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const localSlidesDir = path.join(__dirname, '..', 'public', 'slides');

async function uploadFile(localPath, destPath) {
  await bucket.upload(localPath, {
    destination: destPath,
    metadata: {
      cacheControl: 'public, max-age=31536000'
    }
  });
  return `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(destPath)}?alt=media`;
}

async function run() {
  console.log('Uploading default assets to Firebase Storage...');
  
  const files = fs.readdirSync(localSlidesDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
  const urls = {};
  
  for (const file of files) {
    const localPath = path.join(localSlidesDir, file);
    const destPath = `slides/photos/${file}`;
    console.log(`Uploading ${file} -> ${destPath}...`);
    const url = await uploadFile(localPath, destPath);
    urls[file] = url;
    console.log(`Uploaded! URL: ${url}`);
  }
  
  console.log('\nUpdating Firestore collections with cloud URLs...');
  
  // 1. Update Slideshow
  try {
    const slideshowSnap = await db.doc('site/slideshow').get();
    if (slideshowSnap.exists) {
      const data = slideshowSnap.data();
      const items = data.items || [];
      const updatedItems = items.map(item => {
        const filename = path.basename(item.image);
        if (urls[filename]) {
          return { ...item, image: urls[filename] };
        }
        return item;
      });
      await db.doc('site/slideshow').update({ items: updatedItems });
      console.log('✅ Updated site/slideshow with cloud URLs.');
    }
  } catch (err) {
    console.error('Error updating site/slideshow:', err);
  }

  // 2. Update Faculty
  try {
    const facultySnap = await db.doc('site/faculty').get();
    if (facultySnap.exists) {
      const data = facultySnap.data();
      const items = data.items || [];
      const updatedItems = items.map(item => {
        if (item.photo) {
          const filename = path.basename(item.photo);
          if (urls[filename]) {
            return { ...item, photo: urls[filename] };
          }
        }
        return item;
      });
      await db.doc('site/faculty').update({ items: updatedItems });
      console.log('✅ Updated site/faculty with cloud URLs.');
    }
  } catch (err) {
    console.error('Error updating site/faculty:', err);
  }

  console.log('\nDone seeding and uploading static assets to Firebase Storage! 🎉');
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
