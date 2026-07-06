const fs = require('fs');
let content = fs.readFileSync('src/app/[tenant_slug]/page.tsx', 'utf-8');

// Update input type to always be password
content = content.replace(
  'type={selectedRole === \'admin\' ? "password" : "text"}',
  'type="password"'
);

// Add inline CSS to hide the reveal password icon
const cssToInject = `
      <style>{'\\
        input[type="password"]::-ms-reveal,\\
        input[type="password"]::-ms-clear {\\
          display: none;\\
        }\\
        input[type="password"]::-webkit-textfield-decoration-container {\\
          visibility: hidden;\\
        }\\
      '}</style>`;

if (!content.includes('::-ms-reveal')) {
    content = content.replace('<div className="relative w-full max-w-sm mx-auto p-4 z-10 flex flex-col items-center justify-center min-h-screen">', '<div className="relative w-full max-w-sm mx-auto p-4 z-10 flex flex-col items-center justify-center min-h-screen">' + cssToInject);
}

fs.writeFileSync('src/app/[tenant_slug]/page.tsx', content);
console.log('Successfully updated input type and added CSS to hide eye icon!');
