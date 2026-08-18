import sys

def main():
    file_path = 'c:/Users/almir/mmmtodoloquequierocomer/src/components/AdminTab.tsx'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    # Agrego el estado nuevo
    state_inserted = False
    for i, line in enumerate(lines):
        if "const [expandedConfigSection, setExpandedConfigSection]" in line:
            lines.insert(i + 1, "    const [expandedCustomizationSection, setExpandedCustomizationSection] = useState<string | null>(null);\n")
            state_inserted = True
            break
            
    if not state_inserted:
        print("ERROR: No se encontró la declaración de expandedConfigSection")
        return
        
    # Los indices suben en 1 por la linea agregada
    # Rangos correctos 1-based (start inclusivo, end inclusivo):
    # 4142 a 4260
    # 4344 a 4378
    # 4851 a 5289
    # 5290 a 5580
    
    ranges = [
        (4141 + 1, 4260 + 1), 
        (4343 + 1, 4378 + 1),
        (4850 + 1, 5289 + 1),
        (5289 + 1, 5580 + 1)
    ]
    
    extracted_blocks = []
    
    for start_idx, end_idx in ranges:
        block = lines[start_idx:end_idx]
        mod_block = []
        for bline in block:
            bline = bline.replace('expandedConfigSection ===', 'expandedCustomizationSection ===')
            bline = bline.replace("setExpandedConfigSection(prev => prev ===", "setExpandedCustomizationSection(prev => prev ===")
            mod_block.append(bline)
        extracted_blocks.append(mod_block)
        
        for i in range(start_idx, end_idx):
            lines[i] = None
            
    lines = [l for l in lines if l is not None]
    
    super_accordion = []
    super_accordion.append('                        {/* Accordion: Personalización del Local */}\n')
    super_accordion.append('                        <div className="flex flex-col gap-2">\n')
    super_accordion.append('                            <button\n')
    super_accordion.append('                                onClick={() => setExpandedConfigSection(prev => prev === \'personalizacion\' ? null : \'personalizacion\')}\n')
    super_accordion.append('                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${\n')
    super_accordion.append('                                    true \n')
    super_accordion.append('                                      ? (expandedConfigSection === \'personalizacion\' ? \'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]\' : \'bg-slate-900/80 border-orange-500/30 text-orange-400\')\n')
    super_accordion.append('                                      : (expandedConfigSection === \'personalizacion\' ? \'bg-slate-800 border-slate-600 text-white\' : \'bg-slate-950 border-slate-800 text-slate-500 opacity-80\')\n')
    super_accordion.append('                                }`}\n')
    super_accordion.append('                                style={{\n')
    super_accordion.append('                                    borderColor: true ? (expandedConfigSection === \'personalizacion\' ? tenant?.theme_colors?.primary : undefined) : undefined,\n')
    super_accordion.append('                                    color: true ? (expandedConfigSection === \'personalizacion\' ? tenant?.theme_colors?.primary : undefined) : undefined,\n')
    super_accordion.append('                                }}\n')
    super_accordion.append('                            >\n')
    super_accordion.append('                                <div className="flex items-center gap-3">\n')
    super_accordion.append('                                    <Paintbrush className="w-5 h-5" />\n')
    super_accordion.append('                                    <span className="font-bold uppercase text-sm tracking-wider">✅ Personalización del Local</span>\n')
    super_accordion.append('                                </div>\n')
    super_accordion.append('                                {expandedConfigSection === \'personalizacion\' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}\n')
    super_accordion.append('                            </button>\n')
    super_accordion.append('                            {expandedConfigSection === \'personalizacion\' && (\n')
    super_accordion.append('                                <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-5 animate-in slide-in-from-top-2">\n')
    
    for block in extracted_blocks:
        super_accordion.extend(block)
        super_accordion.append('\n')
        
    super_accordion.append('                                </div>\n')
    super_accordion.append('                            )}\n')
    super_accordion.append('                        </div>\n\n')

    insert_idx = -1
    for i, line in enumerate(lines):
        if "{/* Accordion: Personal y Roles */}" in line:
            insert_idx = i
            break
            
    if insert_idx != -1:
        if insert_idx > 0 and lines[insert_idx - 1].strip() == "":
            insert_idx -= 1
        for sa_line in reversed(super_accordion):
            lines.insert(insert_idx, sa_line)
    else:
        print("ERROR: No se encontró donde inyectar el super acordeon")
        return

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
        
    print("SUCCESS")

if __name__ == "__main__":
    main()
