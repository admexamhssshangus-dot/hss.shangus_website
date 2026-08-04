const https = require('https');

function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      console.log(`URL: ${url} -> Status: ${res.statusCode}, Content-Type: ${res.headers['content-type']}`);
      resolve(res.statusCode);
    }).on('error', (e) => {
      console.log(`URL: ${url} -> Error: ${e.message}`);
      resolve(500);
    });
  });
}

async function test() {
  console.log('--- Testing Abroo Ashraf 12th Drive Photo ---');
  await checkUrl('https://lh3.googleusercontent.com/d/1lhfKxc8E8ZPCLDhZ8ce7774du9OcLukz');

  console.log('\n--- Testing Hamid Manzoor 11th Drive Photo (1iDSiGwNU6JvTJElz0jp4ogNcHb1NWuO4) ---');
  await checkUrl('https://lh3.googleusercontent.com/d/1iDSiGwNU6JvTJElz0jp4ogNcHb1NWuO4');

  console.log('\n--- Testing Hamid Manzoor 12th Drive Photo (14ZVIUr5z9M16OfQBwrgT0YyxvxUzXmFH) ---');
  await checkUrl('https://lh3.googleusercontent.com/d/14ZVIUr5z9M16OfQBwrgT0YyxvxUzXmFH');
}

test();
