"use client";

import React, { useState, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ChefHat, 
  ArrowRight, 
  Image as ImageIcon, 
  FileText, 
  ExternalLink, 
  Copy, 
  Check, 
  Palette, 
  Store,
  QrCode
} from 'lucide-react';

export default function MagicScanner() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Estado para la creación del Local Fantasma
  const [isCreating, setIsCreating] = useState(false);
  const [createdTenant, setCreatedTenant] = useState<any | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setIsPdf(selectedFile.type === 'application/pdf');
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const startAnalysis = async () => {
    if (!file) return;
    
    setStatus('analyzing');
    setErrorMessage('');
    setCreatedTenant(null);
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/ai-scanner', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        let errorDetalle = 'Hubo un problema de conexión con la IA.';
        try {
          const errData = await response.json();
          if (errData.error) errorDetalle = errData.error;
        } catch(e) {
          errorDetalle = await response.text();
        }
        throw new Error(errorDetalle);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setResult(data);
      setStatus('success');
      
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'Error desconocido al analizar el archivo.');
    }
  };

  const handleCreateGhostTenant = async () => {
    if (!result) return;
    setIsCreating(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/ai-scanner/create-ghost-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'No se pudo crear el local fantasma.');
      }

      setCreatedTenant(data);
    } catch (err: any) {
      console.error('Error creating ghost tenant:', err);
      setErrorMessage(err.message || 'Error al crear local en base de datos.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdTenant) return;
    const fullUrl = `${window.location.origin}${createdTenant.url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setIsPdf(false);
    setStatus('idle');
    setResult(null);
    setCreatedTenant(null);
    setErrorMessage('');
  };

  const renderIdle = () => (
    <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-neutral-900/50 hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors">
      <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg mb-6 shadow-purple-500/30">
        <Sparkles className="w-10 h-10 text-white" />
      </div>
      <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 text-center">
        El Escáner Mágico
      </h3>
      <p className="text-slate-500 dark:text-slate-400 text-center max-w-md mb-8">
        Saca una foto a un menú impreso o sube un menú digital (Imagen o PDF). Nuestra IA creará tu tienda, fotos de platos e inventario en segundos.
      </p>
      
      {/* Input para Cámara */}
      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={cameraInputRef}
        onChange={handleFileChange}
        capture="environment" 
      />

      {/* Input para Galería/PDF */}
      <input 
        type="file" 
        accept="image/*,application/pdf" 
        className="hidden" 
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <button 
          onClick={() => cameraInputRef.current?.click()}
          className="flex-1 py-4 px-4 bg-slate-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-105 transition-transform shadow-xl cursor-pointer"
        >
          <Camera className="w-5 h-5" />
          Sacar Foto
        </button>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 py-4 px-4 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white border border-slate-200 dark:border-neutral-700 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-105 transition-transform shadow-sm cursor-pointer"
        >
          <Upload className="w-5 h-5" />
          Subir Archivo
        </button>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto">
      <div className="relative w-full aspect-[3/4] md:aspect-video rounded-3xl overflow-hidden shadow-2xl mb-6 border-4 border-white dark:border-neutral-800 bg-slate-100 dark:bg-neutral-900 flex items-center justify-center">
        {isPdf ? (
          <div className="flex flex-col items-center justify-center text-slate-400">
            <FileText className="w-24 h-24 mb-4 text-rose-500 opacity-80" />
            <p className="font-bold text-lg text-slate-700 dark:text-slate-300">Documento PDF</p>
            <p className="text-sm">{file?.name}</p>
          </div>
        ) : (
          <img src={previewUrl!} alt="Menu Preview" className="w-full h-full object-cover" />
        )}
        
        {status === 'analyzing' && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(168,85,247,0.6)]"></div>
            <p className="text-white font-black text-xl animate-pulse flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-400" />
              La IA está creando la tienda...
            </p>
            <p className="text-slate-300 text-xs md:text-sm mt-3 max-w-xs">
              Extrayendo colores del local, estructurando platos, recetas y seleccionando fotos gastronómicas de alta resolución.
            </p>
          </div>
        )}
      </div>

      {status === 'idle' && previewUrl && (
        <div className="flex gap-4 w-full">
          <button 
            onClick={handleReset}
            className="flex-1 py-3 px-4 bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
          >
            Cambiar Foto
          </button>
          <button 
            onClick={startAnalysis}
            className="flex-[2] py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-black flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/30 transition-all hover:-translate-y-1 cursor-pointer"
          >
            <Sparkles className="w-5 h-5" />
            ¡Hacer Magia!
          </button>
        </div>
      )}
    </div>
  );

  const renderSuccess = () => {
    if (!result) return null;
    
    const { identidad, menu } = result;
    const primaryColor = identidad?.colores_sugeridos?.primario || '#f97316';
    const secondaryColor = identidad?.colores_sugeridos?.secundario || '#1e293b';
    const mode = identidad?.colores_sugeridos?.mode || 'dark';

    // Si ya creamos el local fantasma, mostramos la pantalla de éxito con enlaces
    if (createdTenant) {
      const clientUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${createdTenant.url}`;
      return (
        <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="p-8 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl text-white shadow-2xl text-center space-y-4">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Store className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-black tracking-tight">¡Local Fantasma Creado!</h2>
            <p className="text-emerald-100 text-sm max-w-md mx-auto">
              La app de <strong>{createdTenant.name}</strong> ya está viva en Supabase con su identidad de color, banner, categorías y fotos de productos.
            </p>

            <div className="p-4 bg-black/20 rounded-2xl flex items-center justify-between gap-3 text-left">
              <div className="truncate text-xs font-mono text-emerald-200">
                {clientUrl}
              </div>
              <button 
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-white text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-50 transition-colors flex-shrink-0 cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copiedLink ? '¡Copiado!' : 'Copiar Link'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a 
              href={createdTenant.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between group hover:border-emerald-500 transition-all shadow-sm"
            >
              <div>
                <p className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  📱 Carta del Cliente (Web)
                </p>
                <p className="text-xs text-slate-500 mt-1">Cómo verá la app el comensal</p>
              </div>
              <ExternalLink className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
            </a>

            <a 
              href={`${createdTenant.url}#admin`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between group hover:border-purple-500 transition-all shadow-sm"
            >
              <div>
                <p className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  ⚙️ Panel de Control (Admin)
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Clave / PIN único: <span className="font-mono font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">admin123</span>
                </p>
              </div>
              <ExternalLink className="w-5 h-5 text-slate-400 group-hover:text-purple-500 transition-colors" />
            </a>
          </div>

          <div className="pt-2 text-center">
            <button 
              onClick={handleReset}
              className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              ← Escanear Otro Menú
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full max-w-3xl mx-auto space-y-6">
        <div className="p-6 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-3xl flex items-start gap-4">
          <div className="p-3 bg-green-500 text-white rounded-full flex-shrink-0">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-green-900 dark:text-green-400">¡Lectura y Diseño Completados!</h2>
            <p className="text-green-700 dark:text-green-300/80 text-sm mt-1">
              La IA extrajo la carta, asignó fotos gastronómicas profesionales y recreó la paleta de colores de la marca.
            </p>
          </div>
        </div>

        {/* Resumen Identidad y Colores de Marca */}
        <div className="p-6 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl shadow-sm space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-purple-500" />
            Identidad de Marca & Colores
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Nombre del Local</p>
              <p className="text-xl font-black">{identidad?.nombre_sugerido || 'Restaurante Sin Nombre'}</p>
              {identidad?.estilo_gastronomico && (
                <span className="inline-block mt-1 text-[11px] px-2.5 py-0.5 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded-full font-bold">
                  {identidad.estilo_gastronomico}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Slogan o Descripción</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{identidad?.descripcion_corta}</p>
            </div>
          </div>

          {/* Paleta de Colores Detectada */}
          <div className="pt-3 border-t border-slate-100 dark:border-neutral-800 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full shadow-md border-2 border-white dark:border-neutral-800" style={{ backgroundColor: primaryColor }} />
              <div>
                <p className="text-[10px] text-slate-400 font-black uppercase">Color Primario</p>
                <p className="text-xs font-mono font-bold uppercase">{primaryColor}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full shadow-md border-2 border-white dark:border-neutral-800" style={{ backgroundColor: secondaryColor }} />
              <div>
                <p className="text-[10px] text-slate-400 font-black uppercase">Color Fondo/Secundario</p>
                <p className="text-xs font-mono font-bold uppercase">{secondaryColor}</p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Palette className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                Modo: {mode === 'dark' ? '🌙 Oscuro' : '☀️ Claro'}
              </span>
            </div>
          </div>
        </div>

        {/* Resumen Menú con Fotos */}
        <div className="p-6 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-indigo-500" />
              Menú y Fotos Gastronómicas ({menu?.length || 0} Categorías)
            </h3>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg">
              ✓ Fotos de alta definición listas
            </span>
          </div>
          
          <div className="space-y-6">
            {menu?.map((categoria: any, idx: number) => (
              <div key={idx} className="border-l-4 pl-4" style={{ borderColor: primaryColor }}>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-md font-black uppercase tracking-wider">{categoria.nombre_categoria}</h4>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-400 rounded-md font-bold uppercase">
                    Sector: {categoria.tipo_sector}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categoria.productos?.map((prod: any, pIdx: number) => (
                    <div key={pIdx} className="p-2.5 bg-slate-50 dark:bg-neutral-950 rounded-2xl border border-slate-100 dark:border-neutral-800 flex gap-3 items-center">
                      {prod.image_url ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-200 dark:bg-neutral-800 shadow-inner">
                          <img src={prod.image_url} alt={prod.nombre} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="w-6 h-6 text-slate-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="font-bold text-sm leading-tight truncate pr-2">{prod.nombre}</p>
                          <p className="font-black text-sm text-green-600 dark:text-green-400 flex-shrink-0">${prod.precio}</p>
                        </div>
                        {prod.descripcion_atractiva && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{prod.descripcion_atractiva}</p>
                        )}
                        {prod.ingredientes_base && prod.ingredientes_base.length > 0 && (
                          <p className="text-[10px] text-slate-400 mt-1 truncate">
                            <span className="font-bold text-slate-500">Receta: </span> 
                            {prod.ingredientes_base.map((i: any) => i.nombre).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button 
            onClick={handleReset}
            disabled={isCreating}
            className="flex-1 py-4 px-4 bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-300 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Escanear Otro
          </button>
          
          <button 
            onClick={handleCreateGhostTenant}
            disabled={isCreating}
            className="flex-[2] py-4 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-xl disabled:opacity-50 cursor-pointer"
          >
            {isCreating ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creando Local Fantasma en Supabase...
              </>
            ) : (
              <>
                Crear Local Fantasma Ahora <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-8">
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl flex items-center gap-3 text-red-700 dark:text-red-400">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <p className="text-sm font-medium">{errorMessage}</p>
          <button onClick={() => setErrorMessage('')} className="ml-auto underline font-bold text-xs cursor-pointer">Cerrar</button>
        </div>
      )}

      {status === 'idle' && !previewUrl && renderIdle()}
      
      {(status === 'idle' || status === 'analyzing') && previewUrl && renderPreview()}
      
      {status === 'success' && renderSuccess()}
    </div>
  );
}
