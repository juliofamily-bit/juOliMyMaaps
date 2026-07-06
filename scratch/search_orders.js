const fs = require('fs');
const content = fs.readFileSync('src/hooks/useRealtimeData.ts', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes(".from('orders')")) {
    console.log((index + 1) + ': ' + line.trim());
  }
});
