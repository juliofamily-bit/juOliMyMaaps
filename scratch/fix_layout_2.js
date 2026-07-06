const fs = require('fs');
let content = fs.readFileSync('src/components/AdminTab.tsx', 'utf-8');

const oldControls = `                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <div className="flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mr-2">`;
const newControls = `                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap mt-2 sm:mt-0">
                            <div className="flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mr-2 sm:mr-2">`;

content = content.replace(oldControls, newControls);
fs.writeFileSync('src/components/AdminTab.tsx', content);
console.log('done layout 2');
