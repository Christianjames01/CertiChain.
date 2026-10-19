function DigitalCopyChoice({ checked, onChange, disabled }) {
    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                marginTop: 14,
                padding: '10px 12px',
                border: '1px solid var(--line, rgba(16, 24, 39, 0.12))',
                borderRadius: 10,
                fontSize: 13.5,
                cursor: disabled ? 'not-allowed' : 'pointer',
                maxWidth: 560,
            }}
        >
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} style={{ marginTop: 3 }} />
            <span>
                <strong>Email the digital copy (PDF) to the student</strong>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--slate)', marginTop: 2 }}>
                    The sealed PDF is created and recorded on the blockchain either way. Tick this to send it to the student&apos;s
                    email as soon as it is ready. You can still send it later from the Digital Credential card.
                </span>
            </span>
        </label>
    )
}

export default DigitalCopyChoice
