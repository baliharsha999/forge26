import os, re

for root, dirs, files in os.walk('d:/buildathon/frontend/src/components'):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            import_match = re.search(r'import\s*\{([^}]+)\}\s*from\s*[\'\"]lucide-react[\'\"]', content)
            imported = set(x.strip() for x in import_match.group(1).split(',') if x.strip()) if import_match else set()
            tags = set(re.findall(r'<([A-Z][a-zA-Z0-9]+)', content))
            for tag in tags:
                if tag in ['React', 'Fragment', 'div', 'span'] or tag.endswith('Modal') or tag.endswith('Card') or tag.endswith('Props') or tag.endswith('Item'):
                    continue
                if tag not in imported and not tag.startswith('HTML') and tag not in content.split('const ')[1:]:
                    print(f'{f}: potential missing tag {tag}')
