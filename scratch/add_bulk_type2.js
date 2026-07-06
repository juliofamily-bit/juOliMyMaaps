const fs = require('fs');
let lines = fs.readFileSync('src/components/AdminTab.tsx', 'utf-8').split('\n');

// Find and replace handleBulkPriceUpdate
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const handleBulkPriceUpdate = async () => {')) {
        // delete until try {
        let j = i;
        while (j < lines.length && !lines[j].includes('const newPrice = Math.round(prod.price * (1 + (percentVal / 100)));')) {
            j++;
        }
        if (j < lines.length) {
            const newBlock = `    const handleBulkPriceUpdate = async () => {
        const val = parseFloat(bulkPercent);
        if (isNaN(val) || val === 0) {
            alert("⚠️ Por favor ingresa un monto válido.");
            return;
        }

        const count = selectedProductIds.length;
        const confirmMsg = \`¿Estás seguro de que deseas aplicar un aumento de \${bulkAmountType === 'percent' ? val + '%' : '$' + val} en lote a los \${count} productos seleccionados?\\n\\nLos precios serán redondeados.\`;
        
        if (!window.confirm(confirmMsg)) {
            return;
        }

        setIsBulkUpdating(true);
        try {
            let successCount = 0;
            let errorOccurred = false;

            for (const productId of selectedProductIds) {
                const prod = products.find(p => p.id === productId);
                if (!prod) continue;

                const newPrice = bulkAmountType === 'percent' 
                    ? Math.round(prod.price * (1 + (val / 100)))
                    : Math.round(prod.price + val);`;
            
            lines.splice(i, j - i + 1, ...newBlock.split('\n').map(l => l + '\r'));
        }
        break;
    }
}

// Find and replace the UI block
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('onChange={(e) => setBulkPercent(e.target.value)}')) {
        let j = i;
        while(j > 0 && !lines[j].includes('relative flex items-center')) j--;
        let k = i;
        while(k < lines.length && !lines[k].includes('</div>')) k++;
        
        if (j > 0 && k < lines.length) {
            const newUI = `                            <div className="flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mr-2">
                                <button
                                    onClick={() => setBulkAmountType('percent')}
                                    className={\`px-3 py-1.5 text-[10px] font-black transition-all \${bulkAmountType === 'percent' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-300'}\`}
                                >
                                    %
                                </button>
                                <button
                                    onClick={() => setBulkAmountType('fixed')}
                                    className={\`px-3 py-1.5 text-[10px] font-black transition-all \${bulkAmountType === 'fixed' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-300'}\`}
                                >
                                    $
                                </button>
                            </div>
                            <div className="relative flex items-center">
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={bulkPercent}
                                    onChange={(e) => setBulkPercent(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-bold outline-none focus:border-orange-500/50 w-20 text-center pr-5"
                                />
                                <span className="absolute right-2 text-[10px] font-black text-slate-500">{bulkAmountType === 'percent' ? '%' : '$'}</span>
                            </div>`;
            lines.splice(j, k - j + 1, ...newUI.split('\n').map(l => l + '\r'));
        }
        break;
    }
}

fs.writeFileSync('src/components/AdminTab.tsx', lines.join('\n'));
console.log('done 2');
