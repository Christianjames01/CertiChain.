# Moving CertiChain's blockchain records to Polygon mainnet

CertiChain records credential fingerprints on **Ethereum Sepolia** (free test network) by default.
Use these steps only when HCDC approves real use. Polygon mainnet costs real money (POL), usually well under ₱1 per batch.

## 1. School wallet
- Create a **new MetaMask wallet owned by HCDC** (not a personal one). Store its recovery phrase offline.
- Buy a small amount of **POL** (₱300–₱500 lasts a long time) on an exchange such as Coins.ph or Binance.
- Withdraw it to the school wallet address on the **Polygon** network.

## 2. Alchemy
- In the Alchemy app, enable **Polygon PoS → Mainnet** and copy the URL:
  `https://polygon-mainnet.g.alchemy.com/v2/<key>`

## 3. Deploy the contract on mainnet
```
cd <scratchpad>\blockchain
node deploy-contract.cjs
```
- Paste the Polygon mainnet URL and the school wallet's private key.
- It asks you to type **YES** before spending real POL.
- Copy the printed `CHAIN_CONTRACT_ADDRESS`.

## 4. Supabase secrets (Edge Functions → Secrets)
| Secret | Value |
|---|---|
| `CHAIN_NETWORK` | `polygon` |
| `CHAIN_RPC_URL` | the Polygon mainnet Alchemy URL |
| `CHAIN_PRIVATE_KEY` | the school wallet's private key |
| `CHAIN_CONTRACT_ADDRESS` | the new mainnet contract address |

Then redeploy:
```
npx supabase functions deploy anchor-credentials
npx supabase functions deploy verify-credential
```

## 5. Website links (Vercel → Project → Settings → Environment Variables)
- Add `VITE_CHAIN_EXPLORER` = `https://polygonscan.com`, then redeploy the site.

## 6. Publish the contract source (optional)
```
set CHAIN_NETWORK=polygon
set CHAIN_CONTRACT_ADDRESS=<mainnet contract address>
node verify-on-etherscan.cjs
```

## 7. Re-record existing credentials on the new network (required)
Records already on Sepolia are not on Polygon. Without this step, the verify page would look for them on Polygon,
not find them, and mark them as tampered. Run this once in the Supabase SQL Editor right after step 4:
```sql
update public.credentials
set chain_status = 'pending', chain_tx_hash = null, chain_block = null, chain_recorded_at = null,
    chain_revoke_tx_hash = null, chain_revoked_at = null, chain_error = null, chain_attempts = 0;

update public.document_seals
set chain_status = 'pending', chain_tx_hash = null, chain_block = null, chain_recorded_at = null,
    chain_error = null, chain_attempts = 0;
```
Within a few minutes they are recorded again on Polygon (revoked ones are recorded and then marked revoked).

## Notes
- Keep enough POL in the wallet. The system warns when the balance is low.
