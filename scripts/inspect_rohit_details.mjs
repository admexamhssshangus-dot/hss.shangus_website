import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import crypto from 'crypto';

const sa = JSON.parse(fs.readFileSync('./scripts/serviceAccount.json', 'utf8'));

function getAccessToken() {
  return new Promise((resolve) => {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    })).toString('base64url');
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(header + '.' + claim);
    const sig = signer.sign(sa.private_key, 'base64url');
    const jwt = header + '.' + claim + '.' + sig;
    const postData = 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt;
    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d).access_token));
    });
    req.write(postData); req.end();
  });
}

function parseVal(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(parseVal);
  if ('mapValue' in val) {
    const o = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) o[k] = parseVal(v);
    return o;
  }
  return null;
}

async function getDoc(p, token) {
  return new Promise(r => {
    https.get('https://firestore.googleapis.com/v1/projects/hsssdb/databases/(default)/documents/' + p, { headers: { Authorization: 'Bearer ' + token } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try {
          const j = JSON.parse(d);
          const f = j.fields || {};
          const o = {};
          for (const [k, v] of Object.entries(f)) o[k] = parseVal(v);
          r(o);
        } catch (e) {
          r({});
        }
      });
    });
  });
}

async function main() {
  const token = await getAccessToken();
  const adm = await getDoc('admissions/adm_250510', token);
  console.log('--- admissions/adm_250510 ---');
  console.log(JSON.stringify(adm, null, 2));

  const chunk118 = await getDoc('masterRegisters/chunk_118', token);
  console.log('--- masterRegisters/chunk_118 matching Rohit ---');
  (chunk118.items || []).filter(it => JSON.stringify(it).toLowerCase().includes('rohit')).forEach(it => console.log(JSON.stringify(it, null, 2)));

  const chunk121 = await getDoc('masterRegisters/chunk_121', token);
  console.log('--- masterRegisters/chunk_121 matching Rohit ---');
  (chunk121.items || []).filter(it => JSON.stringify(it).toLowerCase().includes('rohit')).forEach(it => console.log(JSON.stringify(it, null, 2)));

  const pDoc = await getDoc('practicalsData/12th_Physics_Internal Assessment_2025-26', token);
  console.log('--- practicalsData/12th_Physics_Internal Assessment_2025-26 matching Rohit ---');
  (pDoc.records || []).filter(r => JSON.stringify(r).toLowerCase().includes('rohit') || JSON.stringify(r).includes('201000224') || JSON.stringify(r).includes('301004100')).forEach(r => console.log(JSON.stringify(r, null, 2)));
}

main().catch(console.error);
