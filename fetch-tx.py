import urllib.request, json
req = urllib.request.Request('https://api.mainnet-beta.solana.com', json.dumps({"jsonrpc":"2.0", "id":1, "method":"getSignaturesForAddress", "params": ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", {"limit": 50}]}).encode(), {'Content-Type': 'application/json'})
sigs = json.loads(urllib.request.urlopen(req).read())['result']
for sig_info in sigs:
    sig = sig_info['signature']
    req = urllib.request.Request('https://api.mainnet-beta.solana.com', json.dumps({"jsonrpc":"2.0", "id":1, "method":"getTransaction", "params": [sig, {"maxSupportedTransactionVersion": 0, "encoding": "jsonParsed"}]}).encode(), {'Content-Type': 'application/json'})
    try:
        res = json.loads(urllib.request.urlopen(req).read())
        if 'error' not in res and res['result']:
            tx = res['result']
            if 'transactions' not in tx:
                # it is just tx
                pass
            keys = tx['transaction']['message']['accountKeys']
            # accountKeys can be a list of objects with 'pubkey' or just strings
            pubkeys = [k['pubkey'] if type(k) == dict and 'pubkey' in k else k for k in keys]
            if 'JUP6LkbZbjS1jKKwapdH67DPUehq2A2i3R3f4zK4b2L' in pubkeys:
                print("Found Jupiter TX:", sig)
                with open('scenarios/fixtures/captured_real_tx.json', 'w') as f:
                    json.dump({"signature": sig, "transaction": tx}, f, indent=2)
                exit(0)
    except Exception as e:
        pass
print("Not found")
