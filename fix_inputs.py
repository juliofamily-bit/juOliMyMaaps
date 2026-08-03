import re
f = r'c:\Users\almir\mmmtodoloquequierocomer\src\components\PublicMenu.tsx'
with open(f, 'r', encoding='utf-8') as file:
    c = file.read()

# For inputs having bg-neutral-950 or bg-neutral-900 but missing text-white or text-slate
modified = re.sub(r'(className="[^"]*bg-neutral-9[05]0[^"]*)(?<!text-white)(?<!text-slate-900)(?<!text-slate-800)(?<!text-purple-400)(?<!text-amber-400)(?<!text-yellow-400)(?<!text-red-500)(?<!text-neutral-300)(?<!text-green-500)(?<!text-white)(?<!text-neutral-400)(?<!text-neutral-500)(?<!text-slate-700)(")', r'\1 text-white\2', c)

with open(f, 'w', encoding='utf-8') as file:
    file.write(modified)
