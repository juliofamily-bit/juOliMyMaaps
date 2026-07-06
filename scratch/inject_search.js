const fs = require('fs');
let content = fs.readFileSync('src/components/OrderTab.tsx', 'utf-8');

// 1. Add states and mic icon
if (!content.includes('const [searchQuery, setSearchQuery]')) {
    content = content.replace(
        'const [showSummary, setShowSummary] = useState(false);',
        `const [showSummary, setShowSummary] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isListening, setIsListening] = useState(false);`
    );
    
    // Make sure Mic icon is imported
    if (!content.includes('Mic,')) {
        content = content.replace('Search, Info, Coins } from \'lucide-react\'', 'Search, Info, Coins, Mic } from \'lucide-react\'');
    }
}

// 2. Add handleVoiceSearch function
if (!content.includes('const handleVoiceSearch = () => {')) {
    content = content.replace(
        'const { addNotification } = useNotifications();',
        `const { addNotification } = useNotifications();

    const handleVoiceSearch = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari.');
            return;
        }
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-AR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setSearchQuery(transcript);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
    };`
    );
}

// 3. Add search bar UI above categories
// We will look for <div className="space-y-4 mb-4"> (where the clientName input is)
const uiBlockToFind = '{queue.length > 0 && (';
const searchUI = `
                    <div className="relative mb-4 flex items-center gap-2 animate-in slide-in-from-top-2">
                        <div className="relative flex-1">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50">
                                <Search size={16} />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar productos (ej. combo hamburguesa)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={\`w-full rounded-2xl py-3 pl-10 pr-10 text-xs font-bold outline-none transition-all shadow-sm border \${
                                    isLight 
                                        ? 'bg-white border-slate-200 text-slate-900 focus:border-orange-500' 
                                        : 'bg-slate-900 border-slate-800 text-white focus:border-orange-500'
                                }\`}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={handleVoiceSearch}
                            className={\`h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center transition-all shadow-sm border \${
                                isListening 
                                    ? 'bg-red-500 text-white border-red-500 animate-pulse' 
                                    : isLight 
                                        ? 'bg-white text-slate-700 border-slate-200 hover:border-orange-500 hover:text-orange-500' 
                                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-orange-500 hover:text-orange-500'
                            }\`}
                        >
                            <Mic size={18} className={isListening ? 'animate-bounce' : ''} />
                        </button>
                    </div>

                    `;
if (!content.includes('Buscar productos (ej. combo hamburguesa)')) {
    content = content.replace(uiBlockToFind, searchUI + uiBlockToFind);
}

// 4. Modify the category/product rendering logic to handle searchQuery
// Currently it checks {!selectedCategoryId ? ( render categories ) : ( render products )}
// We change it to:
// {searchQuery ? ( render filtered ALL products ) : !selectedCategoryId ? ( render categories ) : ( render products for category )}

const categoryRenderBlock = '{!selectedCategoryId ? (';
const searchRenderBlock = `
                    {searchQuery ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in">
                            {(() => {
                                const q = searchQuery.toLowerCase().trim();
                                const displayedProducts = products.filter(p => p.is_active !== false && p.name.toLowerCase().includes(q));
                                
                                if (displayedProducts.length === 0) {
                                    return (
                                        <div className="col-span-full py-10 text-center text-slate-500">
                                            No se encontraron productos para "{searchQuery}"
                                        </div>
                                    );
                                }
                                
                                return displayedProducts.map(p => {
                                    const qty = cart[p.id] || 0;
                                    const isSelected = qty > 0;
                                    const finalPrice = p.price;
                                    return (
                                        <div 
                                            key={p.id}
                                            onClick={() => updateCart(p.id, 1)}
                                            className={\`p-4 rounded-2xl flex flex-col justify-between cursor-pointer transition-all active:scale-[0.98] border shadow-sm relative overflow-hidden \${
                                                isSelected 
                                                    ? 'border-orange-500 bg-orange-500/10' 
                                                    : isLight 
                                                        ? 'bg-white border-slate-200/65 hover:border-orange-500/30' 
                                                        : 'glass border-white/5 hover:border-orange-500/30'
                                            }\`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className={\`font-black uppercase tracking-tight text-sm pr-4 leading-tight \${isLight ? 'text-slate-800' : 'text-white'}\`}>{p.name}</h4>
                                                <span className="font-black text-orange-500 whitespace-nowrap bg-orange-500/10 px-2 py-0.5 rounded-lg text-xs">{formatARS(finalPrice)}</span>
                                            </div>
                                            {isSelected && (
                                                <div className="flex items-center justify-between mt-3 bg-slate-900/40 p-1.5 rounded-xl border border-white/10" onClick={(e) => e.stopPropagation()}>
                                                    <button 
                                                        onClick={() => updateCart(p.id, -1)}
                                                        className="w-8 h-8 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <span className="font-black text-sm text-white w-8 text-center">{qty}</span>
                                                    <button 
                                                        onClick={() => updateCart(p.id, 1)}
                                                        className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-colors"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    ) : !selectedCategoryId ? (`

if (content.includes(categoryRenderBlock) && !content.includes('{searchQuery ? (')) {
    content = content.replace(categoryRenderBlock, searchRenderBlock);
}

// 5. Also hide the "Volver a Categorías" button if searchQuery is active
const backBtnBlock = '{selectedCategoryId && (';
const newBackBtnBlock = '{selectedCategoryId && !searchQuery && (';
if (content.includes(backBtnBlock) && !content.includes(newBackBtnBlock)) {
    content = content.replace(backBtnBlock, newBackBtnBlock);
}

fs.writeFileSync('src/components/OrderTab.tsx', content);
console.log('Successfully injected search bar with voice recognition!');
