import http from 'http';

function testFilter(amenity) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:5000/api/ashrams?verified=true&amenities=${encodeURIComponent(amenity)}`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function verify() {
  console.log('--- TESTING API FILTER BEHAVIOR ---');
  
  const acResults = await testFilter('AC');
  console.log(`\nQuery: [amenities=AC] -> Found ${acResults.data?.length || 0} Ashrams:`);
  (acResults.data || []).forEach(a => console.log(` - ${a.name} (${a.address.city})`));

  const riverResults = await testFilter('River View');
  console.log(`\nQuery: [amenities=River View] -> Found ${riverResults.data?.length || 0} Ashrams:`);
  (riverResults.data || []).forEach(a => console.log(` - ${a.name} (${a.address.city})`));
  
  process.exit(0);
}

verify().catch(console.error);
