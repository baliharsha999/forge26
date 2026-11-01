import urllib.request, re

req = urllib.request.urlopen('https://nagarik-ai-civic-2026.web.app', timeout=10)
html = req.read().decode('utf-8')
print('HTML length:', len(html))
scripts = re.findall(r'<script[^>]*src=[\"\']([^\"\']+)[\"\']', html)
links = re.findall(r'<link[^>]*href=[\"\']([^\"\']+)[\"\']', html)
print('Scripts:', scripts)
print('Links:', links)
for s in scripts:
    url = 'https://nagarik-ai-civic-2026.web.app/' + s.lstrip('./')
    try:
        r = urllib.request.urlopen(url, timeout=10)
        print('Script OK:', s, 'Status:', r.status, 'Size:', len(r.read()))
    except Exception as e:
        print('Script FAIL:', s, e)
for l in links:
    if 'css' in l or 'png' in l:
        url = 'https://nagarik-ai-civic-2026.web.app/' + l.lstrip('./')
        try:
            r = urllib.request.urlopen(url, timeout=10)
            print('Link OK:', l, 'Status:', r.status, 'Size:', len(r.read()))
        except Exception as e:
            print('Link FAIL:', l, e)
