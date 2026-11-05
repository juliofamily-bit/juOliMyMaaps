import React from 'react';
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

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
            {/* ESTILOS DE IMPRESIÓN A4 RECORTABLE */}
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
                        margin: 6mm;
                    }
                    .page-break-avoid {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                }
                `}
            </style>

            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative text-white">
                {/* Cabecera del Modal (No se imprime) */}
                <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-slate-950/60 no-print">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            <Printer size={22} />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-white uppercase italic tracking-wide">
                                Planilla de Códigos QR para Mesas
                            </h3>
                            <p className="text-[11px] text-slate-400 font-bold">
                                {tables.length} {tables.length === 1 ? 'mesa configurada' : 'mesas listas para imprimir en 1 hoja A4 con líneas recortables'}
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

                {/* Área de Previsualización y Contenido Imprimible */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/40">
                    <div className="no-print mb-4 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-amber-300 text-xs font-bold">
                        <span className="flex items-center gap-2">
                            <Scissors size={15} className="shrink-0 text-amber-400" />
                            Al imprimir, se ordenan 10 mesas por hoja A4 con líneas punteadas para recortar y colocar en los atriles o mesas.
                        </span>
                        <span className="text-[10px] bg-amber-500/20 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                            Formato A4 Recortable
                        </span>
                    </div>

                    {/* CONTENEDOR MAESTRO DE LA PLANILLA IMPRIMIBLE */}
                    <div id="printable-batch-tables-qr" className="bg-white text-slate-900 rounded-2xl p-4 sm:p-6 shadow-inner">
                        {/* Grilla: 2 columnas en A4 para que entren exactamente 10 tarjetas por hoja */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {tables.map((table, idx) => {
                                const tableQrUrl = `${origin}/${tenantSlug}/menu?table=${table.id}&scan=true`;
                                const cleanTableName = table.name.trim();

                                return (
                                    <div
                                        key={table.id || idx}
                                        className="page-break-avoid border-2 border-dashed border-slate-300 rounded-2xl p-3.5 flex flex-col items-center justify-between text-center bg-white relative hover:border-orange-400 transition-colors"
                                        style={{ minHeight: '235px' }}
                                    >
                                        {/* Icono de tijera en la esquina superior izquierda */}
                                        <div className="absolute top-1 left-1 text-slate-300 flex items-center gap-0.5 text-[8px] font-black uppercase tracking-tighter select-none">
                                            <Scissors size={10} />
                                            <span>recortar</span>
                                        </div>

                                        {/* CABECERA: Nombre del Local y Número de Mesa */}
                                        <div className="w-full pt-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block truncate">
                                                {tenantName}
                                            </span>
                                            <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight mt-0.5">
                                                {cleanTableName.toLowerCase().startsWith('mesa') 
                                                    ? cleanTableName.toUpperCase() 
                                                    : `MESA ${cleanTableName.toUpperCase()}`}
                                            </h4>
                                        </div>

                                        {/* CÓDIGO QR EN ALTA DEFINICIÓN (SVG Vectorial Nítido) */}
                                        <div className="my-1.5 p-2 bg-white rounded-xl border border-slate-200 shadow-sm inline-block">
                                            <QRCodeSVG
                                                value={tableQrUrl}
                                                size={118}
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

                {/* Pie del modal */}
                <div className="p-4 border-t border-white/10 bg-slate-950/80 flex items-center justify-between no-print">
                    <span className="text-xs text-slate-400 font-bold">
                        Tip: En el diálogo de impresión elegí <strong>"Guardar como PDF"</strong> o tu impresora conectada.
                    </span>
                    <button
                        onClick={handlePrint}
                        className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                    >
                        <Printer size={15} />
                        <span>Imprimir {tables.length} Mesas</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
