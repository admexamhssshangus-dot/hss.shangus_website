const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'hsssdb';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/site/`;

const slidesDir = path.join(__dirname, '..', 'public', 'slides');

// Helper to convert arbitrary JSON to Firestore document format
function jsonToFirestore(obj) {
    if (obj === null) return { nullValue: null };
    if (typeof obj === 'boolean') return { booleanValue: obj };
    if (typeof obj === 'number') return { doubleValue: obj };
    if (typeof obj === 'string') return { stringValue: obj };
    if (Array.isArray(obj)) {
        return { arrayValue: { values: obj.map(jsonToFirestore) } };
    }
    if (typeof obj === 'object') {
        const fields = {};
        for (const [key, value] of Object.entries(obj)) {
            fields[key] = jsonToFirestore(value);
        }
        return { mapValue: { fields } };
    }
}

async function writeDoc(docId, data) {
    // Format payload for Firestore REST API
    let payload;
    if (typeof data === 'object' && !Array.isArray(data) && data !== null) {
        // Top level must be a document with fields
        const fields = {};
        for (const [key, value] of Object.entries(data)) {
            fields[key] = jsonToFirestore(value);
        }
        payload = { fields };
    } else {
        payload = { fields: { data: jsonToFirestore(data) } };
    }

    const res = await fetch(`${BASE_URL}${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
}

async function seed() {
    console.log('Seeding Firestore via REST API (open rules)...');

    // 1. Settings
    try {
        const settings = JSON.parse(fs.readFileSync(path.join(slidesDir, 'settings.json'), 'utf8'));
        await writeDoc('settings', settings);
        console.log('✅ Settings seeded');
    } catch (e) { console.error('❌ Settings:', e.message); }

    // 2. Admins
    try {
        const admins = JSON.parse(fs.readFileSync(path.join(slidesDir, 'admins.json'), 'utf8'));
        const emails = admins.map(a => (a.email || '').toLowerCase()).filter(Boolean);
        await writeDoc('admins', { items: admins, emails });
        console.log('✅ Admins seeded');
    } catch (e) { console.error('❌ Admins:', e.message); }

    // 3. Faculty
    try {
        const faculty = JSON.parse(fs.readFileSync(path.join(slidesDir, 'faculty.json'), 'utf8'));
        const cleanedFaculty = faculty.map(({ id, ...rest }) => rest);
        await writeDoc('faculty', { items: cleanedFaculty });
        console.log(`✅ Faculty seeded (${cleanedFaculty.length} items)`);
    } catch (e) { console.error('❌ Faculty:', e.message); }

    // 4. Notices
    try {
        const noticesText = fs.readFileSync(path.join(slidesDir, 'notices.txt'), 'utf8');
        await writeDoc('notices', { text: noticesText });
        console.log('✅ Notices seeded');
    } catch (e) { console.error('❌ Notices:', e.message); }
}

seed();
