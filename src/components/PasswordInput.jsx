import { useState } from 'react'
import PasswordToggleButton from '../pages/auth/PasswordToggleButton'
import './PasswordInput.css'

function PasswordInput({ className = '', style, ...props }) {
    const [show, setShow] = useState(false)
    return (
        <div className="pw-field" style={style}>
            <input {...props} className={className} type={show ? 'text' : 'password'} />
            <PasswordToggleButton show={show} onToggle={() => setShow((v) => !v)} />
        </div>
    )
}

export default PasswordInput
