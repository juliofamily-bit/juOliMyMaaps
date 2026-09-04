import MagicScanner from '@/components/MagicScanner';

export const metadata = {
  title: 'Escáner Mágico - Modo Vendedor',
  description: 'Convierte un menú físico en una tienda online funcional en 30 segundos.',
};

export default function MagicScannerPage() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-neutral-950 flex flex-col">
      <header className="p-4 bg-white dark:bg-neutral-900 shadow-sm border-b border-slate-200 dark:border-neutral-800">
        <h1 className="text-xl font-black text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600">
          Laboratorio M&M - Escáner Mágico ⚡
        </h1>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <MagicScanner />
      </main>
    </div>
  );
}
