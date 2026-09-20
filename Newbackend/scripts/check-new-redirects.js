const https = require('https');

function getRedirectLocation(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = https.get({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      }, (res) => {
        resolve({ status: res.statusCode, location: res.headers.location });
      });
      req.on('error', (e) => resolve({ error: e.message }));
    } catch (e) {
      resolve({ error: e.message });
    }
  });
}

async function run() {
  const urls = [
    { name: 'FabHotel Shri Hari Singh Dham', url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQENRHeqCZVNJtjeeWbwViXRKDaxydtwdYCFlzr96_hvh9PyzJcL3CXGSuz-mNiYysXBfi22o1ObYqIgFQxO1uxT47-gfU6AUm6s_6QXlG8_nL3jQXf9rv4YDH3wSfQf-pGB-_umaEs0E_8Geu7UAL6MVmzWigclNDyTdlFd-eAO1fP2VC5bC1Qs14tfFdL8wOddsmE1ApVtI95WWGPl1PVfeLuKwpg80Wy_BHpUxiMeTkR606eDQ6PczwVpOC0G4m3p8evFhRgaVfWdLUXuSzKumh6WCbI2edCwgPPBUMISXbwKHsQtTqfn-Y2bIcVwKw==' },
    { name: 'The Vrind Orchid MMT', url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFTEh3bjbz8c4EUg1rnRmWYDbRo8s2UfGG0yY9vVn4Na9ja-MrYqPoAVsRfu85oSIF3LfvuzV5dIe5ezhHEf70kuUuVusuzvMAfGqD5upm-_IhvL07GfT3hIaMRW5w6gCBSIDZ72uJYb1deYDvPgYQI4GveB9ox3iUrvL9EzQEA0YyzXaFMUanx' },
    { name: 'Kripa Hotel Justdial', url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHumLVy0_f4Gx3TNFXHtIYr7AsD8RLsLxRNSAKvfaK0Ua52zOlJa9UoZjNDItw9v3iwIKYOIZizn6jUtVRGQFsNk9_OUR1GLQ405bTxxzboOPpykzmqZO9n4FVtNdNd4FH0EqArXUJ_sNMmA5aEbHm_2nNVSwbY0YKbuX8Vr_IN9oHtwJGFBgTm7NM7MuXIom3FaI4d6eRAOB0SRra18i-7HwFZMIkDOJ0tGLkW' }
  ];

  for (const u of urls) {
    const res = await getRedirectLocation(u.url);
    console.log(u.name, '=>', res.location || res);
  }
}

run();
