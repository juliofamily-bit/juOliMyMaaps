const fs = require('fs');
let content = fs.readFileSync('src/components/AdminTab.tsx', 'utf-8');
content = content.replace(
  /const \[bulkAmountType, setBulkAmountType\] = useState<'percent' \| 'fixed'>\('percent'\);\r?\n\s*const \[bulkAmountType, setBulkAmountType\] = useState<'percent' \| 'fixed'>\('percent'\);/,
  "const [bulkAmountType, setBulkAmountType] = useState<'percent' | 'fixed'>('percent');"
);
fs.writeFileSync('src/components/AdminTab.tsx', content);
console.log('done 5');
