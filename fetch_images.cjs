const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const match = data.match(/<meta property="og:image" content="([^"]+)"/);
        if (match) resolve(match[1]);
        else resolve(null);
      });
    }).on('error', reject);
  });
}

async function main() {
  const urls = [
    'https://ibb.co/0VVm6pMc',
    'https://ibb.co/GvtbNBKM',
    'https://ibb.co/G4jTXWHw'
  ];
  for (const url of urls) {
    const img = await fetchUrl(url);
    console.log(img);
  }
}

main();
