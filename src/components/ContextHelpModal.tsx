'use client';

import React from 'react';
import { HelpItem } from '@/data/contextualHelpData';
import { HelpCircle, X, CheckCircle2, Sparkles, Lightbulb } from 'lucide-react';

interface ContextHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: HelpItem | null;
  primaryColor?: string;
}

export default function ContextHelpModal({
  isOpen,
  onClose,
  data,
  primaryColor = '#f97316'
}: ContextHelpModalProps) {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-[2.5rem] bg-slate-950 border-2 border-orange-500/30 text-white shadow-[0_0_80px_rgba(249,115,22,0.25)] animate-in zoom-in-95 duration-200 overflow-hidden"
        style={{ borderColor: `${primaryColor}55` }}
      >
        {/* Encabezado Superior con Halo */}
        <div className="relative p-6 pb-4 border-b border-white/10 flex items-start justify-between bg-gradient-to-b from-white/5 to-transparent">
          <div className="flex items-center gap-3.5">
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border border-white/10 shrink-0"
              style={{ 
                background: `linear-gradient(135deg, ${primaryColor}33, ${primaryColor}11)`,
                color: primaryColor
              }}
            >
              <HelpCircle size={28} className="animate-pulse" />
            </div>
            <div>
              <span 
                className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full inline-block border border-white/10 mb-1"
                style={{ 
                  backgroundColor: `${primaryColor}22`,
                  color: primaryColor
                }}
              >
                {data.badge}
              </span>
              <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white leading-tight">
                {data.title}
              </h3>
            </div>
          </div>

          {/* Botón Crucecita */}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-slate-300 hover:text-white transition-all border border-white/10 shrink-0 ml-2"
          >
            <X size={18} className="stroke-[2.5]" />
          </button>
        </div>

        {/* Contenido Scrollable */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar text-sm leading-relaxed">
          {/* ¿Para qué sirve? */}
          <div className="bg-slate-900/70 p-4 rounded-2xl border border-white/5 space-y-1.5 shadow-inner">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-400 flex items-center gap-1.5" style={{ color: primaryColor }}>
              <Sparkles size={12} /> ¿Para qué sirve este apartado?
            </h4>
            <p className="text-slate-200 text-xs sm:text-sm font-medium">
              {data.whatIs}
            </p>
          </div>

          {/* Pasos Obligatorios / Lo que tenés que hacer sí o sí */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-emerald-400" /> Lo que tenés que configurar sí o sí:
            </h4>
            <div className="grid gap-2">
              {data.mustDoSteps.map((step, idx) => (
                <div 
                  key={idx} 
                  className="bg-slate-900/40 p-3 rounded-2xl border border-white/5 flex items-start gap-3 hover:border-white/10 transition-colors"
                >
                  <div 
                    className="w-6 h-6 rounded-xl flex items-center justify-center font-black text-xs shrink-0 text-slate-950 mt-0.5 shadow-sm"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <h5 className="font-black text-white text-xs uppercase tracking-wide">
                      {step.title}
                    </h5>
                    <p className="text-slate-300 text-xs font-normal mt-0.5 leading-snug">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Beneficio Comercial / Impacto en el Negocio */}
          <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-2xl space-y-1 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 block">
              🚀 Impacto en tu Negocio:
            </span>
            <p className="text-emerald-200 text-xs font-semibold leading-relaxed">
              {data.businessBenefit}
            </p>
          </div>

          {/* Tip Extra (opcional) */}
          {data.tip && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-2.5 text-amber-300 text-xs font-medium">
              <Lightbulb size={16} className="shrink-0 text-amber-400" />
              <span><b>Consejo Pro:</b> {data.tip}</span>
            </div>
          )}
        </div>

        {/* Footer con Botón de Entendido */}
        <div className="p-4 bg-slate-950 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider text-slate-950 hover:brightness-110 active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            <CheckCircle2 size={16} className="stroke-[3]" />
            ¡Entendido, gracias!
          </button>
        </div>
      </div>
    </div>
  );
}
