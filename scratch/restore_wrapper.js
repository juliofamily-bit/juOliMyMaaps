const fs = require('fs');
let content = fs.readFileSync('src/components/AdminTab.tsx', 'utf-8');

const target = "{selectedProductIds.length > 0 && (\r\n                    <div className=\"flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 w-full\">";
const replacement = `{selectedProductIds.length > 0 && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-xl bg-slate-900/95 border border-orange-500/30 backdrop-blur-md p-4 rounded-3xl shadow-[0_10px_30px_rgba(249,115,22,0.15)] animate-in fade-in slide-in-from-top-6 duration-200">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 w-full">`;

const target2 = "{selectedProductIds.length > 0 && (\n                    <div className=\"flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 w-full\">";

if (content.includes(target)) {
    content = content.replace(target, replacement);
    console.log('replaced rn');
} else if (content.includes(target2)) {
    content = content.replace(target2, replacement);
    console.log('replaced n');
} else {
    console.log('could not find target string');
}

fs.writeFileSync('src/components/AdminTab.tsx', content);
