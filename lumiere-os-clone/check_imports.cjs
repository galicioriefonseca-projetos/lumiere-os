const http = require('http');

async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    }).on('error', reject);
  });
}

const visited = new Set();
const queue = ['/src/pages/dashboard/DashboardHome.tsx'];

async function crawl() {
  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    // Strip query params for logging, but use them for fetching
    const { statusCode, data } = await fetchUrl(`http://localhost:3000${current}`);
    if (statusCode !== 200) {
      console.log(`Error: ${current} returned ${statusCode}`);
      continue;
    }

    const importRegex = /(?:import\s+.*?from\s+|import\s*\(|import\s+[\"\'])[\"\'](\/[^\"\']+)[\"\']/g;
    let match;
    while ((match = importRegex.exec(data)) !== null) {
      if (!visited.has(match[1])) {
        queue.push(match[1]);
      }
    }
  }
  console.log(`Done crawling. Visited ${visited.size} files.`);
}

crawl().catch(console.error);
