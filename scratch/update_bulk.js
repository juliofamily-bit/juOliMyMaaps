const fs = require('fs');
let content = fs.readFileSync('src/components/AdminTab.tsx', 'utf-8');

content = content.replace(
  'const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);\n    const [bulkPercent, setBulkPercent] = useState(\'\');\n    const [isBulkUpdating, setIsBulkUpdating] = useState(false);',
  'const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);\n    const [bulkPercent, setBulkPercent] = useState(\'\');\n    const [bulkUpdateType, setBulkUpdateType] = useState<\'percent\' | \'fixed\'>(\'percent\');\n    const [isBulkUpdating, setIsBulkUpdating] = useState(false);'
);

content = content.replace(
  `    const handleBulkPriceUpdate = async () => {
        const percentVal = parseFloat(bulkPercent);
        if (isNaN(percentVal) || percentVal === 0) {
            alert("⚠️ Por favor ingresa un porcentaje de aumento válido.");
            return;
        }

        const count = selectedProductIds.length;
        const confirmMsg = \`¿Estás seguro de que deseas aplicar un aumento del \${percentVal}% en lote a los \${count} productos seleccionados?\\n\\nLos precios serán redondeados al entero más cercano.\`;
        
        if (!window.confirm(confirmMsg)) {
            return;
        }

        setIsBulkUpdating(true);
        try {
            // Actualizar individualmente cada producto seleccionado en Supabase
            let successCount = 0;
            let errorOccurred = false;

            for (const productId of selectedProductIds) {
                const prod = products.find(p => p.id === productId);
                if (!prod) continue;

                const newPrice = Math.round(prod.price * (1 + (percentVal / 100)));
                
                const { error } = await supabase
                    .from('products')
                    .update({ price: newPrice })
                    .eq('id', productId);`,
  `    const handleBulkPriceUpdate = async () => {
        const value = parseFloat(bulkPercent);
        if (isNaN(value) || value === 0) {
            alert("⚠️ Por favor ingresa un valor de aumento válido.");
            return;
        }

        const count = selectedProductIds.length;
        const typeLabel = bulkUpdateType === 'percent' ? \`del \${value}%\` : \`de \${formatARS(value)}\`;
        const confirmMsg = \`¿Estás seguro de que deseas aplicar un aumento \${typeLabel} en lote a los \${count} productos seleccionados?\\n\\nLos precios serán redondeados al entero más cercano.\`;
        
        if (!window.confirm(confirmMsg)) {
            return;
        }

        setIsBulkUpdating(true);
        try {
            // Actualizar individualmente cada producto seleccionado en Supabase
            let successCount = 0;
            let errorOccurred = false;

            for (const productId of selectedProductIds) {
                const prod = products.find(p => p.id === productId);
                if (!prod) continue;

                let newPrice;
                if (bulkUpdateType === 'percent') {
                    newPrice = Math.round(prod.price * (1 + (value / 100)));
                } else {
                    newPrice = Math.round(prod.price + value);
                }
                
                const { error } = await supabase
                    .from('products')
                    .update({ price: newPrice })
                    .eq('id', productId);`
);

const uiOriginal = `                            <div className="relative flex items-center">
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={bulkPercent}
                                    onChange={(e) => setBulkPercent(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-bold outline-none focus:border-orange-500/50 w-20 text-center pr-5"
                                />
                                <span className="absolute right-2 text-[10px] font-black text-slate-500">%</span>
                            </div>`;

const uiReplacement = `                            <div className="flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mr-2">
                                <button
                                    onClick={() => setBulkUpdateType('percent')}
                                    className={\`px-3 py-1.5 text-[10px] font-black uppercase transition-colors \${bulkUpdateType === 'percent' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}\`}
                                >
                                    %
                                </button>
                                <button
                                    onClick={() => setBulkUpdateType('fixed')}
                                    className={\`px-3 py-1.5 text-[10px] font-black uppercase transition-colors \${bulkUpdateType === 'fixed' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}\`}
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
                                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-bold outline-none focus:border-orange-500/50 w-24 text-center pr-5"
                                />
                                <span className="absolute right-2 text-[10px] font-black text-slate-500">
                                    {bulkUpdateType === 'percent' ? '%' : '$'}
                                </span>
                            </div>`;

content = content.replace(uiOriginal, uiReplacement);

fs.writeFileSync('src/components/AdminTab.tsx', content);
console.log('Modified AdminTab.tsx successfully!');
