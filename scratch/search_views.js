const fs = require('fs');
const content = fs.readFileSync('src/components/AdminTab.tsx', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes("view === 'products'") || line.includes("view === 'stock'")) {
    console.log((index + 1) + ': ' + line.trim());
  }
});
