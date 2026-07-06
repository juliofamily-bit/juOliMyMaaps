const fs = require('fs');
const content = fs.readFileSync('src/components/AdminTab.tsx', 'utf-8');
const lines = content.split('\n');
let inSub = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("view === 'subscription'")) inSub = true;
  if (inSub && lines[i].includes("view === 'employees'")) inSub = false;
  if (inSub) console.log((i+1) + ': ' + lines[i].trim());
}
