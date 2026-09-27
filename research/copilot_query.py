import os, sys, json, urllib.request, concurrent.futures

def call(item):
    path, body = item['path'], item.get('body')
    base = os.environ.get('COLOSSEUM_COPILOT_API_BASE', 'https://copilot.colosseum.com/api/v1').rstrip('/')
    headers = {'Content-Type': 'application/json'}
    if not path.startswith('https://'):
        headers['Authorization'] = 'Bearer ' + os.environ['COLOSSEUM_COPILOT_PAT']
    url = path if path.startswith('https://') else base + path
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.load(response)
        return {'label': item.get('label', path), 'data': result}
    except Exception as exc:
        return {'label': item.get('label', path), 'error': str(exc)}

items = json.load(open(sys.argv[1], encoding='utf-8'))
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for result in pool.map(call, items):
        print(json.dumps(result, ensure_ascii=True), flush=True)
