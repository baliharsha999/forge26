import re, os

dir_path = 'd:/buildathon/frontend/dist/assets'
for fname in os.listdir(dir_path):
    if fname.endswith('.js'):
        fpath = os.path.join(dir_path, fname)
        with open(fpath, 'r', encoding='utf-8') as f:
            text = f.read()
        imports = re.findall(r'from\s*[\'"]([^\'"]+)[\'"]', text)
        print(f'{fname} imports: {set(imports)}')
