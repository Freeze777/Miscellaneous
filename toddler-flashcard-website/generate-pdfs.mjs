import puppeteer from 'puppeteer-core';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 18765;

const MIME = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.js':   'text/javascript',
  '.css':  'text/css',
};

// Minimal static file server so Wikipedia CORS works (file:// blocks it)
const server = createServer((req, res) => {
  try {
    const file = join(__dirname, req.url === '/' ? '/toddler-flashcard.html' : req.url);
    const data = readFileSync(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'text/plain' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end();
  }
});

await new Promise(r => server.listen(PORT, r));
console.log(`Server running on http://localhost:${PORT}`);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
});

const page = await browser.newPage();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });

for (let i = 1; i <= 7; i++) {
  const key = `vol-${i}`;
  const outFile = join(__dirname, `flashcards-volume-${i}.pdf`);

  console.log(`Generating Volume ${i}...`);

  // Select the volume (triggers buildCards + image loading)
  await page.select('#preset-select', key);

  // Wait until all card images have a src (placeholder or real photo)
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('.card img')];
    return imgs.length === 50 && imgs.every(img => img.src);
  }, { timeout: 90_000 });

  // Small settle delay so any final repaints complete
  await new Promise(r => setTimeout(r, 800));

  await page.pdf({
    path: outFile,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  console.log(`  Saved: ${outFile}`);
}

await browser.close();
server.close();
console.log('\nAll 7 PDFs generated.');
