import React, { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, X, Scissors, Smartphone, Utensils } from 'lucide-react';

interface TableItem {
    id: string;
    name: string;
    capacity?: number;
}

interface PrintableBatchTablesQRProps {
    tables: TableItem[];
    tenant: any;
    onClose: () => void;
}

export const PrintableBatchTablesQR: React.FC<PrintableBatchTablesQRProps> = ({ tables, tenant, onClose }) => {
    if (!tenant) return null;

    const handlePrint = () => {
        window.print();
    };

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mymenulocal.com';
    const tenantName = tenant.name || 'Restaurante';
    const tenantSlug = tenant.slug || '';

    // Agrupar mesas en bloques de exactamente 6 mesas por hoja A4 (2 columnas x 3 filas)
    const pages = useMemo(() => {
        const chunks: TableItem[][] = [];
        const validTables = Array.isArray(tables) ? tables : [];
        for (let i = 0; i < validTables.length; i += 6) {
            chunks.push(validTables.slice(i, i + 6));
        }
        return chunks.length > 0 ? chunks : [[]];
    }, [tables]);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in">
            {/* ESTILOS DE IMPRESIÓN A4 ESTRICTOS (6 MESAS POR PÁGINA) */}
            <style>
                {`
                @media print {
                    /* Ocultar toda la interfaz web */
                    body * {
                        visibility: hidden !important;
                    }
                    /* Mostrar únicamente la planilla de mesas */
                    #printable-batch-tables-qr, #printable-batch-tables-qr * {
                        visibility: visible !important;
                    }
                    #printable-batch-tables-qr {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        display: block !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 8mm 6mm 8mm 6mm;
                    }
                    .a4-print-sheet {
                        width: 100% !important;
                        max-width: 198mm !important;
                        height: 280mm !important;
                        max-height: 280mm !important;
                        margin: 0 auto !important;
                        padding: 2mm !important;
                        box-sizing: border-box !important;
                        display: grid !important;
                        grid-template-columns: repeat(2, 1fr) !important;
                        grid-template-rows: repeat(3, 1fr) !important;
                        gap: 4mm !important;
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                    .a4-print-sheet:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                    .table-card-print {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        height: 86mm !important;
                        max-height: 86mm !important;
                        box-sizing: border-box !important;
                    }
                }
                `}
            </style>

            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden relative text-white">
                {/* Cabecera del Modal (No se imprime) */}
                <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/70 no-print">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            <Printer size={22} />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-white uppercase italic tracking-wide">
                                Plantilla de Códigos QR para Mesas (Hoja A4)
                            </h3>
                            <p className="text-[11px] text-slate-400 font-bold">
                                {tables.length} {tables.length === 1 ? 'mesa configurada' : 'mesas'} • Exactamente 6 mesas por hoja A4 ({pages.length} {pages.length === 1 ? 'página' : 'páginas'} en total)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-lg shadow-orange-500/30 transition-all cursor-pointer"
                        >
                            <Printer size={15} />
                            <span>Imprimir / Guardar PDF</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                            title="Cerrar vista"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Banner Informativo (No se imprime) */}
                <div className="no-print mx-4 sm:mx-6 mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-amber-300 text-xs font-bold">
                    <span className="flex items-center gap-2">
                        <Scissors size={16} className="shrink-0 text-amber-400" />
                        Distribución A4: Cada hoja contiene hasta 6 mesas con líneas punteadas y tijeras listas para recortar.
                    </span>
                    <span className="text-[10px] bg-amber-500/20 px-2.5 py-1 rounded-lg uppercase tracking-wider whitespace-nowrap">
                        {pages.length} {pages.length === 1 ? 'Hoja A4' : 'Hojas A4'} Requeridas
                    </span>
                </div>

                {/* Área de Previsualización que simula Hojas A4 reales */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-950/60 space-y-6">
                    {/* CONTENEDOR MAESTRO DE IMPRESIÓN */}
                    <div id="printable-batch-tables-qr" className="space-y-8">
                        {pages.map((pageTables, pageIndex) => (
                            <div key={`page-${pageIndex}`} className="flex flex-col items-center">
                                {/* Indicador de hoja en pantalla (no se imprime) */}
                                <div className="no-print mb-2 text-center">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-white/10 shadow-sm">
                                        Hoja A4 Nº {pageIndex + 1} de {pages.length} ({pageTables.length} {pageTables.length === 1 ? 'mesa' : 'mesas'})
                                    </span>
                                </div>

                                {/* PLANILLA DE HOJA A4 FÍSICA */}
                                <div className="a4-print-sheet bg-white text-slate-900 rounded-xl shadow-2xl p-4 sm:p-6 w-full max-w-[210mm] border border-slate-200">
                                    {/* Grilla de 2 columnas x 3 filas */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 w-full">
                                        {pageTables.map((table, idx) => {
                                            const tableQrUrl = `${origin}/${tenantSlug}/menu?table=${table.id}&scan=true`;
                                            const cleanTableName = (table.name || '').trim();

                                            return (
                                                <div
                                                    key={table.id || idx}
                                                    className="table-card-print border-2 border-dashed border-slate-300 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-between text-center bg-white relative hover:border-orange-400 transition-colors shadow-sm"
                                                    style={{ minHeight: '215px' }}
                                                >
                                                    {/* Icono de tijera en la esquina superior izquierda */}
                                                    <div className="absolute top-1 left-1.5 text-slate-400 flex items-center gap-0.5 text-[8px] font-black uppercase tracking-tighter select-none">
                                                        <Scissors size={10} />
                                                        <span>recortar</span>
                                                    </div>

                                                    {/* CABECERA: Nombre del Local y Número de Mesa */}
                                                    <div className="w-full pt-1.5">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block truncate">
                                                            {tenantName}
                                                        </span>
                                                        <h4 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight leading-tight mt-0.5">
                                                            {cleanTableName.toLowerCase().startsWith('mesa') 
                                                                ? cleanTableName.toUpperCase() 
                                                                : `MESA ${cleanTableName.toUpperCase()}`}
                                                        </h4>
                                                    </div>

                                                    {/* CÓDIGO QR EN ALTA DEFINICIÓN (SVG Vectorial Nítido) */}
                                                    <div className="my-1.5 p-2 bg-white rounded-xl border border-slate-200 shadow-sm inline-block">
                                                        <QRCodeSVG
                                                            value={tableQrUrl}
                                                            size={96}
                                                            level="M"
                                                            includeMargin={false}
                                                        />
                                                    </div>

                                                    {/* PIE DE TARJETA: Instrucción al comensal */}
                                                    <div className="w-full border-t border-slate-100 pt-1.5 pb-0.5">
                                                        <div className="flex items-center justify-center gap-1 text-[10px] font-black text-slate-800 uppercase tracking-wide">
                                                            <Smartphone size={11} className="text-orange-500" />
                                                            <span>Escaneá y pedí desde tu celular</span>
                                                        </div>
                                                        <p className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                                            Sin esperas • Auto-pedido y llamado de mozo
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pie del modal (no se imprime) */}
                <div className="p-4 border-t border-white/10 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
                    <span className="text-xs text-slate-400 font-bold text-center sm:text-left">
                        Tip: En la vista previa de impresión elegí tamaño <strong>A4</strong> y escala <strong>Ajustar al área de impresión</strong> (100%).
                    </span>
                    <button
                        onClick={handlePrint}
                        className="w-full sm:w-auto px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95"
                    >
                        <Printer size={15} />
                        <span>Imprimir {tables.length} {tables.length === 1 ? 'Mesa' : 'Mesas'} ({pages.length} {pages.length === 1 ? 'Hoja A4' : 'Hojas A4'})</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
