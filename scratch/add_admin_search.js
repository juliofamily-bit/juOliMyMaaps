const fs = require('fs');
let content = fs.readFileSync('src/components/AdminTab.tsx', 'utf-8');

// 1. Add states
const stateMatch = 'const [isStockModalOpen, setIsStockModalOpen] = useState(false);';
const stateReplacement = \`const [isStockModalOpen, setIsStockModalOpen] = useState(false);
    const [adminProductSearchQuery, setAdminProductSearchQuery] = useState('');
    const [isAdminProductListening, setIsAdminProductListening] = useState(false);
    const [adminStockSearchQuery, setAdminStockSearchQuery] = useState('');
    const [isAdminStockListening, setIsAdminStockListening] = useState(false);
\`;
content = content.replace(stateMatch, stateReplacement);

// 2. Add Voice Handlers
const handlerMatch = '    const handleIngredientVoiceSearch = () => {';
const handlerReplacement = \`    const handleAdminProductVoiceSearch = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari.');
            return;
        }
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-AR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsAdminProductListening(true);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setAdminProductSearchQuery(transcript);
        };
        recognition.onerror = () => setIsAdminProductListening(false);
        recognition.onend = () => setIsAdminProductListening(false);
        recognition.start();
    };

    const handleAdminStockVoiceSearch = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari.');
            return;
        }
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-AR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsAdminStockListening(true);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setAdminStockSearchQuery(transcript);
        };
        recognition.onerror = () => setIsAdminStockListening(false);
        recognition.onend = () => setIsAdminStockListening(false);
        recognition.start();
    };

    const handleIngredientVoiceSearch = () => {\`;
content = content.replace(handlerMatch, handlerReplacement);

// 3. Inject Search UI for Stock
const stockUiMatch = \`                    <div className="space-y-3">
                        {ingredients.map(item => {\`;
const stockUiReplacement = \`                    <div className="mb-4">
                        <div className="relative flex items-center gap-2">
                            <div className="relative flex-1">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50">
                                    <Search size={16} />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar en almacén (ej. Pan, Carne)..."
                                    value={adminStockSearchQuery}
                                    onChange={(e) => setAdminStockSearchQuery(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-10 text-sm font-bold text-white outline-none focus:border-orange-500 transition-all"
                                />
                                {adminStockSearchQuery && (
                                    <button onClick={() => setAdminStockSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 p-1">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={handleAdminStockVoiceSearch}
                                className={\`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center transition-all shadow-sm border \${
                                    isAdminStockListening 
                                        ? 'bg-red-500 text-white border-red-500 animate-pulse' 
                                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-orange-500 hover:text-orange-500'
                                }\`}
                            >
                                <Mic size={18} className={isAdminStockListening ? 'animate-bounce' : ''} />
                            </button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {ingredients.filter(inv => inv.name.toLowerCase().includes(adminStockSearchQuery.toLowerCase().trim())).map(item => {\`;
content = content.replace(stockUiMatch, stockUiReplacement);

// 4. Inject Search UI for Products
const productUiMatch = \`                    {categories.map(cat => {
                        const catActiveProducts = products.filter(p => p.category_id === cat.id && p.is_active !== false);
                        const activeProdIds = catActiveProducts.map(p => p.id);\`;
const productUiReplacement = \`                    <div className="mb-4">
                        <div className="relative flex items-center gap-2">
                            <div className="relative flex-1">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50">
                                    <Search size={16} />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar productos (ej. Hamburguesa, Papas)..."
                                    value={adminProductSearchQuery}
                                    onChange={(e) => setAdminProductSearchQuery(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-10 text-sm font-bold text-white outline-none focus:border-orange-500 transition-all"
                                />
                                {adminProductSearchQuery && (
                                    <button onClick={() => setAdminProductSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 p-1">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={handleAdminProductVoiceSearch}
                                className={\`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center transition-all shadow-sm border \${
                                    isAdminProductListening 
                                        ? 'bg-red-500 text-white border-red-500 animate-pulse' 
                                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-orange-500 hover:text-orange-500'
                                }\`}
                            >
                                <Mic size={18} className={isAdminProductListening ? 'animate-bounce' : ''} />
                            </button>
                        </div>
                    </div>

                    {categories.map(cat => {
                        const catActiveProducts = products.filter(p => 
                            p.category_id === cat.id && 
                            p.is_active !== false &&
                            (adminProductSearchQuery.trim() === '' || p.name.toLowerCase().includes(adminProductSearchQuery.toLowerCase().trim()))
                        );
                        if (adminProductSearchQuery.trim() !== '' && catActiveProducts.length === 0) return null;
                        
                        const activeProdIds = catActiveProducts.map(p => p.id);\`;
content = content.replace(productUiMatch, productUiReplacement);

fs.writeFileSync('src/components/AdminTab.tsx', content);
console.log('Modified AdminTab.tsx successfully for global search!');
