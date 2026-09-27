import urllib.request, json
last_sig = None
for i in range(10):
    params = ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", {"limit": 100}]
    if last_sig: params[1]['before'] = last_sig
    req = urllib.request.Request('https://api.mainnet-beta.solana.com', json.dumps({"jsonrpc":"2.0", "id":1, "method":"getSignaturesForAddress", "params": params}).encode(), {'Content-Type': 'application/json'})
    res = json.loads(urllib.request.urlopen(req).read())
    if 'error' in res: break
    sigs = res['result']
    for sig_info in sigs:
        sig = sig_info['signature']
        last_sig = sig
        req2 = urllib.request.Request('https://api.mainnet-beta.solana.com', json.dumps({"jsonrpc":"2.0", "id":1, "method":"getTransaction", "params": [sig, {"maxSupportedTransactionVersion": 0, "encoding": "jsonParsed"}]}).encode(), {'Content-Type': 'application/json'})
        try:
            tx_res = json.loads(urllib.request.urlopen(req2).read())
            if 'error' not in tx_res and tx_res['result']:
                tx = tx_res['result']
                if 'transaction' in tx and 'message' in tx['transaction'] and 'accountKeys' in tx['transaction']['message']:
                    keys = tx['transaction']['message']['accountKeys']
                    pubkeys = [k['pubkey'] if type(k) == dict and 'pubkey' in k else k for k in keys]
                    if 'JUP6LkbZbjS1jKKwapdH67DPUehq2A2i3R3f4zK4b2L' in pubkeys:
                        print("Found Jupiter TX:", sig)
                        with open('scenarios/fixtures/captured_real_tx.json', 'w') as f:
                            json.dump({"signature": sig, "transaction": tx}, f, indent=2)
                        exit(0)
        except Exception as e: pass
print("Not found")
