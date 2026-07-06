const fs = require('fs');
for (const file of ['src/components/OrderTab.tsx', 'src/components/PublicMenu.tsx']) {
    let content = fs.readFileSync(file, 'utf-8');
    content = content.replace("import QRCode from 'react-qr-code';\n", "");
    content = content.replace("import QRCode from 'react-qr-code';\r\n", "");
    fs.writeFileSync(file, content);
}
console.log('Fixed qr code import');
