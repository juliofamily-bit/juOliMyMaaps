const fs = require('fs');
let lines = fs.readFileSync('src/components/AdminTab.tsx', 'utf-8').split('\n');

let start = -1;
let end = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Barra Flotante de Acciones Masivas')) {
        start = i + 2; // the div inside {selectedProductIds.length > 0 && (
        break;
    }
}

if (start !== -1) {
    for (let i = start; i < lines.length; i++) {
        if (lines[i].includes('                            </button>')) {
            // Find the closing divs for this block
            // It should be followed by:
            //                         </div>
            //                     </div>
            //                 </div>
            //             )}
            if (lines[i+1].includes('</div>') && lines[i+2].includes('</div>') && lines[i+3].includes('</div>')) {
                end = i + 2;
                break;
            }
        }
    }
}

if (start !== -1 && end !== -1) {
    const newBlock = `                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 w-full">
                        <div className="flex flex-col text-left shrink-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-orange-500">Acciones Masivas</span>
                            <span className="text-[11px] font-bold text-white leading-tight">
                                {selectedProductIds.length} {selectedProductIds.length === 1 ? 'producto seleccionado' : 'productos seleccionados'}
                            </span>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto justify-end mt-2 lg:mt-0">
                            
                            <div className="flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden w-full sm:w-auto shrink-0">
                                <button
                                    onClick={() => setBulkAmountType('percent')}
                                    className={\`flex-1 sm:flex-none px-4 py-2.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-[10px] font-black transition-all \${bulkAmountType === 'percent' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-300'}\`}
                                >
                                    Aumento en %
                                </button>
                                <button
                                    onClick={() => setBulkAmountType('fixed')}
                                    className={\`flex-1 sm:flex-none px-4 py-2.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-[10px] font-black transition-all \${bulkAmountType === 'fixed' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-300'}\`}
                                >
                                    Aumento en $
                                </button>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <div className="relative flex items-center shrink-0">
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={bulkPercent}
                                        onChange={(e) => setBulkPercent(e.target.value)}
                                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 sm:py-1.5 text-xs text-white font-bold outline-none focus:border-orange-500/50 w-24 sm:w-20 text-center pr-6 sm:pr-5"
                                    />
                                    <span className="absolute right-2.5 sm:right-2 text-[11px] sm:text-[10px] font-black text-slate-500">{bulkAmountType === 'percent' ? '%' : '$'}</span>
                                </div>
                                <button
                                    onClick={handleBulkPriceUpdate}
                                    disabled={isBulkUpdating || !bulkPercent}
                                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-4 py-2.5 sm:py-2 rounded-xl text-[11px] sm:text-[10px] font-black uppercase tracking-wider text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1 shrink-0 w-full sm:w-auto"
                                >
                                    {isBulkUpdating ? '...' : 'Aplicar'}
                                </button>
                            </div>
                        </div>
                    </div>`;

    lines.splice(start, end - start + 1, ...newBlock.split('\n').map(l => l + '\r'));
    fs.writeFileSync('src/components/AdminTab.tsx', lines.join('\n'));
    console.log('done layout script');
} else {
    console.log('could not find block', start, end);
}
