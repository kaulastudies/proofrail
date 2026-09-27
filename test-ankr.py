import urllib.request, json
try:
    req = urllib.request.Request('https://rpc.ankr.com/solana', json.dumps({"jsonrpc":"2.0","id":1,"method":"getSlot"}).encode(), {'Content-Type': 'application/json'})
    slot = json.loads(urllib.request.urlopen(req).read())['result']
    print(slot)
except Exception as e:
    print(e)
