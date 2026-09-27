import urllib.request, json
req = urllib.request.Request('https://api.mainnet-beta.solana.com', json.dumps({"jsonrpc":"2.0", "id":1, "method":"getSlot"}).encode(), {'Content-Type': 'application/json'})
slot = json.loads(urllib.request.urlopen(req).read())['result']
print("Starting at slot:", slot)

for i in range(10):
    current_slot = slot - i
    try:
        req = urllib.request.Request('https://api.mainnet-beta.solana.com', json.dumps({"jsonrpc":"2.0", "id":1, "method":"getBlock", "params": [current_slot, {"maxSupportedTransactionVersion": 1}]}).encode(), {'Content-Type': 'application/json'})
        res = json.loads(urllib.request.urlopen(req).read())
        if 'error' not in res:
            block = res['result']
            if block and 'transactions' in block:
                for tx in block['transactions']:
                    keys = tx['transaction']['message']['accountKeys']
                    # Some keys are objects in parsed/unparsed? getBlock default is not parsed. Wait, getBlock returns base58 strings.
                    if 'JUP6LkbZbjS1jKKwapdH67DPUehq2A2i3R3f4zK4b2L' in keys:
                        sig = tx['transaction']['signatures'][0]
                        print("Found signature:", sig)
                        req2 = urllib.request.Request('https://api.mainnet-beta.solana.com', json.dumps({"jsonrpc":"2.0", "id":1, "method":"getTransaction", "params": [sig, {"maxSupportedTransactionVersion": 1, "encoding": "jsonParsed"}]}).encode(), {'Content-Type': 'application/json'})
                        tx_parsed = json.loads(urllib.request.urlopen(req2).read())['result']
                        if tx_parsed:
                            with open('scenarios/fixtures/captured_real_tx.json', 'w') as f:
                                json.dump({"signature": sig, "transaction": tx_parsed}, f, indent=2)
                            print("Saved!")
                            exit(0)
    except Exception as e:
        print(e)
