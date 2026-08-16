import https from 'https';

const url = 'https://firestore.googleapis.com/v1/projects/hsssdb/databases/(default)/documents/masterRegisters/2022-23_11th_part109';

https.get(url, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const json = JSON.parse(body);
    console.log('Doc Name:', json.name);
    console.log('Field names:', Object.keys(json.fields || {}));
    console.log('Full Fields JSON:');
    console.log(JSON.stringify(json.fields, null, 2).substring(0, 1000));
  });
});
