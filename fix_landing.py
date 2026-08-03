import re

f = r'c:\Users\almir\mmmtodoloquequierocomer\src\components\PublicMenu.tsx'
with open(f, 'r', encoding='utf-8') as file:
    lines = file.readlines()

new_lines = []
for i, line in enumerate(lines):
    # Only process landing page related lines, 2100 to 3050.
    if 2100 <= i <= 3050:
        
        # We need to make sure we don't double replace if we run multiple times, 
        # so check if `isLight` is not in the line.
        if 'isLight' not in line:
            # Replace pure static strings that just contain text-white
            if 'className="' in line and 'text-white' in line:
                # Be careful: some are `text-white/70`, `text-white/90`
                line = re.sub(
                    r'className="([^"]*)text-white([^"]*)"',
                    r'className={`\1 \2 ${isLight ? "text-slate-900" : "text-white"}`}',
                    line
                )
            
            # Replace static backgrounds
            if 'className="' in line and 'bg-neutral-9' in line:
                line = re.sub(
                    r'className="([^"]*)bg-neutral-[9][0-9]*[a-zA-Z0-9/-]*([^"]*)"',
                    r'className={`\1 \2 ${isLight ? "bg-slate-100 border-slate-200" : "bg-neutral-900/40 border-neutral-900/60"}`}',
                    line
                )

            # Let's fix text-neutral-400 or 500 when they appear without isLight inside a hardcoded className
            if 'className="' in line and ('text-neutral-400' in line or 'text-neutral-500' in line):
                line = re.sub(
                    r'className="([^"]*)text-neutral-[45]00([^"]*)"',
                    r'className={`\1 \2 ${isLight ? "text-slate-600" : "text-neutral-400"}`}',
                    line
                )

    new_lines.append(line)

with open(f, 'w', encoding='utf-8') as file:
    file.writelines(new_lines)
