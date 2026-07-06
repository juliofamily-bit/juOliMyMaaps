const fs = require('fs');
let c = fs.readFileSync('src/components/AdminTab.tsx', 'utf-8');
c = c.replace(
  "const [bulkPercent, setBulkPercent] = useState('');",
  "const [bulkPercent, setBulkPercent] = useState('');\n    const [bulkAmountType, setBulkAmountType] = useState<'percent' | 'fixed'>('percent');"
);
fs.writeFileSync('src/components/AdminTab.tsx', c);
console.log('done 4');
