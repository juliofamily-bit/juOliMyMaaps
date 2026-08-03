import re

f = r'c:\Users\almir\mmmtodoloquequierocomer\src\components\PublicMenu.tsx'
with open(f, 'r', encoding='utf-8') as file:
    c = file.read()

replacements = [
    (
        'className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-neutral-950/40 border border-neutral-900/60 rounded-[2.5rem] p-6 backdrop-blur-md shadow-2xl text-white"',
        'className={`grid grid-cols-1 md:grid-cols-12 gap-6 rounded-[2.5rem] p-6 backdrop-blur-md shadow-2xl transition-colors ${isLight ? "bg-white border border-slate-200 text-slate-900" : "bg-neutral-950/40 border border-neutral-900/60 text-white"}`}'
    ),
    (
        '<p className="text-white font-bold text-sm leading-relaxed">{socialLinks.address}</p>',
        '<p className={`font-bold text-sm leading-relaxed ${isLight ? "text-slate-900" : "text-white"}`}>{socialLinks.address}</p>'
    ),
    (
        '<p className="text-white font-bold text-sm leading-relaxed">{socialLinks.phone}</p>',
        '<p className={`font-bold text-sm leading-relaxed ${isLight ? "text-slate-900" : "text-white"}`}>{socialLinks.phone}</p>'
    ),
    (
        'className="p-8 md:p-12 rounded-[3rem] bg-neutral-900/50 border border-white/5 backdrop-blur-md shadow-2xl relative overflow-hidden text-white"',
        'className={`p-8 md:p-12 rounded-[3rem] border backdrop-blur-md shadow-2xl relative overflow-hidden transition-colors ${isLight ? "bg-white border-slate-200 text-slate-900" : "bg-neutral-900/50 border-white/5 text-white"}`}'
    ),
    (
        'className="min-w-[300px] md:min-w-[400px] snap-center bg-neutral-900/60 border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl relative group text-white"',
        'className={`min-w-[300px] md:min-w-[400px] snap-center border rounded-[2rem] overflow-hidden shadow-2xl relative group transition-colors ${isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-neutral-900/60 border-white/5 text-white"}`}'
    ),
    (
        'className="h-64 md:h-72 w-full bg-neutral-800 relative overflow-hidden"',
        'className={`h-64 md:h-72 w-full relative overflow-hidden ${isLight ? "bg-slate-200" : "bg-neutral-800"}`}'
    ),
    (
        'className="min-w-[260px] md:min-w-[300px] snap-center bg-neutral-900/60 border border-white/5 rounded-3xl overflow-hidden shadow-xl hover:border-white/20 transition-all duration-300 flex flex-col cursor-pointer text-white"',
        'className={`min-w-[260px] md:min-w-[300px] snap-center border rounded-3xl overflow-hidden shadow-xl transition-all duration-300 flex flex-col cursor-pointer ${isLight ? "bg-white border-slate-200 hover:border-slate-400 text-slate-900" : "bg-neutral-900/60 border-white/5 hover:border-white/20 text-white"}`}'
    ),
    (
        'className="h-48 w-full bg-neutral-800 relative overflow-hidden"',
        'className={`h-48 w-full relative overflow-hidden ${isLight ? "bg-slate-200" : "bg-neutral-800"}`}'
    ),
    (
        'className="w-full h-full flex items-center justify-center bg-neutral-800/50"',
        'className={`w-full h-full flex items-center justify-center ${isLight ? "bg-slate-200/50" : "bg-neutral-800/50"}`}'
    ),
    (
        'className="relative rounded-[2rem] overflow-hidden group border border-white/5 shadow-2xl bg-neutral-900/50 hover:border-white/20 transition-all duration-500 hover:-translate-y-2 text-white"',
        'className={`relative rounded-[2rem] overflow-hidden group border shadow-2xl transition-all duration-500 hover:-translate-y-2 ${isLight ? "bg-white border-slate-200 hover:border-slate-400 text-slate-900" : "bg-neutral-900/50 border-white/5 hover:border-white/20 text-white"}`}'
    ),
    (
        '<h3 className="text-xl md:text-3xl font-black mb-1 drop-shadow-md text-white">',
        '<h3 className={`text-xl md:text-3xl font-black mb-1 drop-shadow-md ${isLight ? "text-slate-900" : "text-white"}`}>'
    ),
    (
        '<p className="text-xs md:text-sm font-medium text-white/90 drop-shadow-md">',
        '<p className={`text-xs md:text-sm font-medium drop-shadow-md ${isLight ? "text-slate-700" : "text-white/90"}`}>'
    ),
    (
        '<h4 className="text-lg md:text-xl font-black mb-1 text-white">',
        '<h4 className={`text-lg md:text-xl font-black mb-1 ${isLight ? "text-slate-900" : "text-white"}`}>'
    ),
    (
        '<p className="text-xs text-white/70 line-clamp-2">',
        '<p className={`text-xs line-clamp-2 ${isLight ? "text-slate-600" : "text-white/70"}`}>'
    ),
    (
        '<h4 className="text-xl md:text-2xl font-black mb-1 line-clamp-1 drop-shadow-sm text-white">',
        '<h4 className={`text-xl md:text-2xl font-black mb-1 line-clamp-1 drop-shadow-sm ${isLight ? "text-slate-900" : "text-white"}`}>'
    ),
    (
        '<p className="text-xs md:text-sm font-medium text-white/90 line-clamp-2">',
        '<p className={`text-xs md:text-sm font-medium line-clamp-2 ${isLight ? "text-slate-700" : "text-white/90"}`}>'
    ),
    (
        'className="w-1/3 min-h-[120px] bg-neutral-800 relative overflow-hidden"',
        'className={`w-1/3 min-h-[120px] relative overflow-hidden ${isLight ? "bg-slate-200" : "bg-neutral-800"}`}'
    )
]

for old, new_ in replacements:
    c = c.replace(old, new_)

# Fix low contrast text in light mode
# Replace 'text-slate-500' with 'text-slate-700' for better contrast in isLight ternary
c = re.sub(r"isLight \? 'text-slate-500' :", "isLight ? 'text-slate-700' :", c)
c = re.sub(r"isLight \? 'text-slate-400' :", "isLight ? 'text-slate-600' :", c)

# Fix background contrasts to be a bit lighter for gray sections (e.g. bg-slate-100 -> bg-slate-200/50 might be too complex, just focus on text)
# Wait, user said "buttons grises un poco mas claritos", I'll just change the text contrast mainly.

with open(f, 'w', encoding='utf-8') as file:
    file.write(c)
