import { useEffect, useState } from 'react'
import { IconCheck, IconQuestion, IconX } from '../../components/UiIcons'

const formatDate = (value) =>
    value
        ? new Date(value).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })
        : ''

async function sha256Hex(text) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return '0x' + [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function CopyButton({ value }) {
    const [copied, setCopied] = useState(false)
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch (err) {
            void err
        }
    }
    return (
        <button type="button" className="verify-copy" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
        </button>
    )
}

function Step({ tone, number, title, children }) {
    const icon = tone === 'ok' ? <IconCheck /> : tone === 'bad' ? <IconX /> : <IconQuestion />
    return (
        <li className={`verify-step is-${tone}`}>
            <span className="verify-step-icon" aria-hidden="true">{icon}</span>
            <div className="verify-step-body">
                <strong><span className="verify-step-number">{number}.</span> {title}</strong>
                {children}
            </div>
        </li>
    )
}

function HashPlayground({ seed }) {
    const [text, setText] = useState(seed)
    const [original, setOriginal] = useState('')
    const [current, setCurrent] = useState('')

    useEffect(() => {
        sha256Hex(seed).then(setOriginal)
    }, [seed])

    useEffect(() => {
        let cancelled = false
        sha256Hex(text).then((h) => { if (!cancelled) setCurrent(h) })
        return () => { cancelled = true }
    }, [text])

    const changed = current && original && current !== original
    const differing = changed ? [...current].filter((c, i) => c !== original[i]).length : 0

    return (
        <details className="verify-playground">
            <summary>Try it yourself: see how a fingerprint changes</summary>
            <p>
                Edit the text below. Even changing one letter gives a completely different fingerprint,
                and the fingerprint can’t be turned back into the text. That is why a changed record can’t match
                the fingerprint saved on the blockchain.
            </p>
            <label className="verify-visually-hidden" htmlFor="verify-playground-input">Text to fingerprint</label>
            <input
                id="verify-playground-input"
                className="verify-input verify-playground-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
            />
            <div className="verify-hash-row">
                <span>Before</span>
                <code className="verify-hash">{original}</code>
            </div>
            <div className={`verify-hash-row${changed ? ' is-changed' : ''}`}>
                <span>After</span>
                <code className="verify-hash">{current}</code>
            </div>
            <p className="verify-playground-note">
                {changed
                    ? `${differing} of 66 characters changed — it no longer matches.`
                    : 'Same text, same fingerprint — it matches.'}
                {text !== seed && (
                    <button type="button" className="verify-copy" onClick={() => setText(seed)}>Reset</button>
                )}
            </p>
        </details>
    )
}

function VerificationSteps({ result }) {
    const chain = result.blockchain || {}
    const signatureTone = result.signatureValid === false ? 'bad' : 'ok'
    const hashTone = chain.hash ? 'ok' : 'wait'

    let lookupTone = 'wait'
    let lookupText = 'Waiting to be recorded on the public blockchain. This usually takes a few minutes after issuing.'
    if (chain.checked && chain.onChain) {
        lookupTone = 'ok'
        lookupText = `Found on the public blockchain. It was recorded on ${formatDate(chain.onChainRecordedAt || chain.recordedAt)}.`
    } else if (chain.checked && !chain.onChain && chain.status === 'recorded') {
        lookupTone = 'bad'
        lookupText = 'This fingerprint is not on the public blockchain. The record was changed after it was recorded.'
    } else if (chain.status === 'recorded') {
        lookupTone = 'ok'
        lookupText = `Recorded on the public blockchain${chain.recordedAt ? ` on ${formatDate(chain.recordedAt)}` : ''}. The live check could not be reached just now.`
    }

    const compareTone = chain.mismatch || result.signatureValid === false ? 'bad' : lookupTone === 'ok' ? 'ok' : 'wait'

    return (
        <details className="verify-how" open>
            <summary>How this was verified</summary>

            <ol className="verify-steps">
                <Step tone="ok" number={1} title="Found the credential">
                    <p>{result.credential_number} is in the Registrar’s records, issued {formatDate(result.generated_at)}.</p>
                </Step>

                <Step tone={signatureTone} number={2} title="Checked the Registrar’s digital signature">
                    <p>
                        {result.signatureValid === false
                            ? 'The signature does not match. Someone changed the record after it was signed.'
                            : 'The signature made with the Registrar’s secret key still matches the record.'}
                    </p>
                </Step>

                <Step tone={hashTone} number={3} title="Computed the credential’s fingerprint">
                    <p>
                        The credential’s details are turned into a unique fingerprint. No personal data is stored on the
                        blockchain, only this fingerprint.
                    </p>
                    {chain.hash ? (
                        <div className="verify-hash-row">
                            <code className="verify-hash">{chain.hash}</code>
                            <CopyButton value={chain.hash} />
                        </div>
                    ) : (
                        <p className="verify-step-muted">Not available yet.</p>
                    )}
                </Step>

                <Step tone={lookupTone} number={4} title="Looked up the fingerprint on the public blockchain">
                    <p>{lookupText}</p>
                    <p className="verify-step-links">
                        {chain.txUrl && <a href={chain.txUrl} target="_blank" rel="noreferrer">Transaction ↗</a>}
                        {chain.revokeTxUrl && <a href={chain.revokeTxUrl} target="_blank" rel="noreferrer">Revocation ↗</a>}
                        {chain.contractUrl && <a href={chain.contractUrl} target="_blank" rel="noreferrer">CertiChain contract ↗</a>}
                    </p>
                </Step>

                <Step tone={compareTone} number={5} title="Compared the results">
                    <p>
                        {compareTone === 'bad'
                            ? 'The record does not match what was originally issued. Do not accept this document.'
                            : compareTone === 'ok'
                                ? 'The record today produces the same fingerprint that was saved on the blockchain, so it has not been changed since it was issued.'
                                : 'The signature matches. The blockchain check will be available once recording finishes.'}
                        {result.status === 'revoked' && (chain.revokedOnChain || chain.revokedAt) && ' The revocation is also recorded on the blockchain.'}
                    </p>
                </Step>
            </ol>

            <HashPlayground seed={`${result.credential_number} | ${result.document_name} | ${result.generated_at}`} />
        </details>
    )
}

export default VerificationSteps
