const fs = require('fs');
const content = fs.readFileSync('src/components/PublicMenu.tsx', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes("status: 'pending'")) {
    console.log((index + 1) + ': ' + line.trim());
  }
});
