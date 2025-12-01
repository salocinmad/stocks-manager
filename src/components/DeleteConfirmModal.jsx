import { useState } from 'react';

export default function DeleteConfirmModal({ isOpen, onConfirm, onCancel, theme }) {
    const [password, setPassword] = useState('');

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm(password);
        setPassword('');
    };

    const handleCancel = () => {
        onCancel();
        setPassword('');
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <h2>⚠️ Confirmar Borrado de Datos</h2>
                <p style={{ marginBottom: '20px', color: '#dc3545', fontWeight: 'bold' }}>
                    Esta acción borrará TODAS las operaciones guardadas. Esta acción NO se puede deshacer.
                </p>
                <div className="form-group">
                    <label>Ingresa la contraseña para confirmar el borrado:</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input"
                        placeholder="Escribe tu contraseña para confirmar"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleConfirm();
                            }
                        }}
                    />
                </div>
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                    <button
                        type="button"
                        className="button danger"
                        onClick={handleConfirm}
                        disabled={!password}
                    >
                        🗑️ Confirmar Borrado
                    </button>
                    <button type="button" className="button" onClick={handleCancel}>
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}
