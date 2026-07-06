const fs = require('fs');
let content = fs.readFileSync('src/components/AdminTab.tsx', 'utf-8');

const oldHeader = `                    <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                        <div className="flex flex-col text-left">`;
const newHeader = `                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex flex-col text-left">`;

const oldControls = `                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <div className="flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mr-2">`;
const newControls = `                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap mt-2 sm:mt-0">
                            <div className="flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">`;

content = content.replace(oldHeader, newHeader);
content = content.replace(oldControls, newControls);

fs.writeFileSync('src/components/AdminTab.tsx', content);
console.log('done layout update');
