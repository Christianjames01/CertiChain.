# Moving CertiChain's blockchain records to the Internet Computer (ICP)

CertiChain stores each credential's SHA-256 fingerprint and AES-256 encrypted copy in a
**canister** (an ICP smart contract) written in Motoko: `icp/registry/Main.mo`.
Only HCDC's registrar identity can write to it; anyone can look records up.

Everything here works on Windows without `dfx` or WSL. Run the scripts from the scratchpad
`icp` folder (it has the Motoko compiler and the ICP libraries installed).

## 1. Make HCDC's ICP identity
```
node icp-make-identity.cjs
```
It prints a **Principal** (public) and `ICP_IDENTITY_SEED` (secret). Save the seed offline.

## 2. Get ICP
- Buy about **2 ICP** (roughly ₱400) on an exchange that lists ICP and allows withdrawals on the
  Internet Computer network.
- Open **nns.ic0.app**, sign in with **Internet Identity**, then Tokens → Internet Computer → **Receive**.
  Send the ICP from the exchange to that address.

## 3. Create the canister (NNS app)
1. NNS app → **Canisters** → **Create Canister**, convert about 1.5 ICP into cycles, confirm.
2. Copy the new **canister ID**.
3. Open the canister → **Controllers** → **Add controller** → paste the Principal from step 1.

## 4. Install the CertiChain registry
```
node icp-install.cjs
```
Paste the canister ID and the `ICP_IDENTITY_SEED` (hidden). It compiles `Main.mo`, installs it,
and prints the owner, the cycles balance and the dashboard link. Running it again later upgrades
the code and keeps all records.

## 5. Supabase → Edge Functions → Secrets
| Secret | Value |
|---|---|
| `CHAIN_NETWORK` | `icp` |
| `ICP_CANISTER_ID` | the canister ID |
| `ICP_IDENTITY_SEED` | the seed from step 1 |
| `CHAIN_ENCRYPTION_KEY` | keep the existing key |

Then redeploy:
```
npx supabase functions deploy anchor-credentials
npx supabase functions deploy verify-credential
```

## 6. Re-record existing credentials on ICP (required)
```sql
update public.credentials
set chain_status = 'pending', chain_tx_hash = null, chain_block = null, chain_recorded_at = null,
    chain_revoke_tx_hash = null, chain_revoked_at = null, chain_error = null, chain_attempts = 0;

update public.document_seals
set chain_status = 'pending', chain_tx_hash = null, chain_block = null, chain_recorded_at = null,
    chain_error = null, chain_attempts = 0;
```

## Topping up cycles
NNS app → Canisters → your canister → **Add cycles**. `icp-install.cjs` shows the current balance
and the daily burn. A canister that runs out of cycles is frozen (records are kept) until topped up.

## Activity log (digital record)
Every write to the registry is also appended to a permanent activity log kept in the canister's
stable storage (enhanced orthogonal persistence), so it survives upgrades and can never be edited.
Entries: `RECORDED`, `REVOKED`, `OWNER_CHANGED`, each with its number, record number, fingerprint,
Philippine time, the signing principal and a note. Records made before the log existed are restored
into it once, on the first upgrade.

Open the Candid UI: `https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=trzz4-6aaaa-aaaan-q6vhq-cai`

| Method | Use |
|---|---|
| `logCount()` | Number of log entries |
| `logs(fromId, limit)` | Oldest first, e.g. `logs(1, 50)` |
| `latestLogs(limit)` | Newest first, e.g. `latestLogs(20)` |
| `historyOf(fingerprint)` | Full history of one credential |
| `stats()` | Records, owner and log size |
