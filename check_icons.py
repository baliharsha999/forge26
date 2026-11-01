import re

with open('d:/buildathon/frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import_match = re.search(r'import\s*\{([^}]+)\}\s*from\s*[\'\"]lucide-react[\'\"]', content)
if import_match:
    imported = set(x.strip() for x in import_match.group(1).split(',') if x.strip())
    print('Imported from lucide-react:', sorted(list(imported)))
else:
    imported = set()

tags = set(re.findall(r'<([A-Z][a-zA-Z0-9]+)', content))

known_components = {
    'AISaathiExtensionModal', 'CivicSettingsModal', 'CivicHelplineModal', 
    'CivicFactCheckModal', 'CivicGrievanceStudioModal', 'CivicSchemeLockerModal'
}

for tag in tags:
    if tag not in known_components and tag not in imported:
        print('MISSING IMPORT:', tag)
