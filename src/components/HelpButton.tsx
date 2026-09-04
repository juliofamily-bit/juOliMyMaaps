'use client';

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import ContextHelpModal from './ContextHelpModal';
import { CONTEXTUAL_HELP_DATA, HelpItem } from '@/data/contextualHelpData';

interface HelpButtonProps {
  helpKey?: string;
  customData?: HelpItem;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  primaryColor?: string;
  className?: string;
}

export default function HelpButton({
  helpKey,
  customData,
  label,
  size = 'md',
  primaryColor = '#f97316',
  className = ''
}: HelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const helpData = customData || (helpKey ? CONTEXTUAL_HELP_DATA[helpKey] : null);
  if (!helpData) return null;

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base'
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 20
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        title="¿Cómo funciona este apartado? Presioná para ver el tutorial"
        className={`inline-flex items-center justify-center gap-1.5 rounded-full font-black transition-all active:scale-90 border shadow-sm group ${
          label 
            ? 'px-3 py-1.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border-white/10 hover:border-orange-500/40' 
            : `${sizeClasses[size]} bg-slate-900/90 hover:bg-orange-500/20 text-slate-400 hover:text-white border-white/10 hover:border-orange-500/50`
        } ${className}`}
      >
        <HelpCircle 
          size={iconSizes[size]} 
          className="text-orange-400 group-hover:scale-110 group-hover:text-orange-300 transition-transform" 
          style={{ color: primaryColor }}
        />
        {label && (
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-300 group-hover:text-white">
            {label}
          </span>
        )}
      </button>

      <ContextHelpModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        data={helpData}
        primaryColor={primaryColor}
      />
    </>
  );
}
