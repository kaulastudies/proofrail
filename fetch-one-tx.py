import urllib.request, json
try:
    req = urllib.request.Request('https://api.mainnet-beta.solana.com', json.dumps({"jsonrpc":"2.0","id":1,"method":"getSlot"}).encode(), {'Content-Type': 'application/json'})
    slot = json.loads(urllib.request.urlopen(req).read())['result'] - 10
    
    for i in range(50):
        req = urllib.request.Request('https://api.mainnet-beta.solana.com', json.dumps({"jsonrpc":"2.0","id":1,"method":"getBlock","params":[slot - i, {"maxSupportedTransactionVersion":0, "transactionDetails":"full", "encoding":"jsonParsed"}]}).encode(), {'Content-Type': 'application/json'})
        res = json.loads(urllib.request.urlopen(req).read())
        
        if 'result' in res and res['result']:
            for tx in res['result']['transactions']:
                keys = tx['transaction']['message']['accountKeys']
                pubkeys = [k['pubkey'] if type(k) == dict and 'pubkey' in k else k for k in keys]
                if 'JUP6LkbZbjS1jKKwapdH67DPUehq2A2i3R3f4zK4b2L' in pubkeys:
                    sig = tx['transaction']['signatures'][0]
                    with open('scenarios/fixtures/captured_real_tx.json', 'w') as f:
                        json.dump({"signature": sig, "transaction": tx}, f, indent=2)
                    print("Captured Real TX:", sig)
                    exit(0)
    print("Not found")
except Exception as e:
    print(e)
