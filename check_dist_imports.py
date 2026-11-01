import re

with open('d:/buildathon/frontend/dist/assets/index-XPiwVJQw.js', 'r', encoding='utf-8') as f:
    text = f.read()

imports = re.findall(r'from\s*[\'"]([^\'"]+)[\'"]', text)
print('Static imports in index-XPiwVJQw.js:', set(imports))
