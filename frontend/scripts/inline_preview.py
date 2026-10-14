import os, re
d=os.path.join(os.path.dirname(__file__), '..', 'dist-preview')
html=open(f'{d}/index.html').read()
for m in re.findall(r'<link rel="stylesheet"[^>]*href="\./(assets/[^"]+)"[^>]*>', html):
    css=open(f'{d}/{m}').read()
    html=re.sub(r'<link rel="stylesheet"[^>]*href="\./'+re.escape(m)+r'"[^>]*>', lambda _: f'<style>{css}</style>', html)
for m in re.findall(r'<script type="module" crossorigin src="\./(assets/[^"]+)"></script>', html):
    js=open(f'{d}/{m}').read().replace('</script','<\\/script')
    html=html.replace(f'<script type="module" crossorigin src="./{m}"></script>','')
    html=html.replace('</body>', f'<script type="module">{js}</script>\n</body>')
html=html.replace('<link rel="icon" href="./favicon.svg" type="image/svg+xml" />','')
html=html.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0" />','<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />')
html=html.replace('<title>Kept</title>','<title>Kept: one workspace for every organization</title>')
open(os.path.join(d, '..', 'kept-live-preview.html'),'w').write(html)
print("built", len(html))
