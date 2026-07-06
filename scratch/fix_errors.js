const fs = require('fs');
let content = fs.readFileSync('src/components/OrderTab.tsx', 'utf-8');

// Fix updateCart -> addToCart / removeFromCart
content = content.replace(/updateCart\(p\.id, 1\)/g, 'addToCart(p.id)');
content = content.replace(/updateCart\(p\.id, -1\)/g, 'removeFromCart(p.id)');

// Fix states if not present
if (!content.includes('const [searchQuery, setSearchQuery]')) {
    content = content.replace(
        'const [showOfflineQueue, setShowOfflineQueue] = useState(false);',
        'const [showOfflineQueue, setShowOfflineQueue] = useState(false);\n    const [searchQuery, setSearchQuery] = useState("");\n    const [isListening, setIsListening] = useState(false);'
    );
}

if (!content.includes('Mic,')) {
    content = content.replace("Search, Info, Coins } from 'lucide-react';", "Search, Info, Coins, Mic } from 'lucide-react';");
}

fs.writeFileSync('src/components/OrderTab.tsx', content);
console.log('Fixed OrderTab!');
