import { useState } from 'react';
import { externalButtonsAPI } from '../services/api.js';

function ExternalButtonsModal({ show, onClose, externalButtons, setExternalButtons }) {
    const [editingButton, setEditingButton] = useState(null);
    const [formData, setFormData] = useState({ name: '', baseUrl: '', imageUrl: '', displayOrder: 1 });
    const [error, setError] = useState('');

    const resetForm = () => {
        setFormData({ name: '', baseUrl: '', imageUrl: '', displayOrder: 1 });
        setEditingButton(null);
        setError('');
    };

    const handleEdit = (button) => {
        setEditingButton(button);
        setFormData({
            name: button.name,
            baseUrl: button.baseUrl,
            imageUrl: button.imageUrl,
            displayOrder: button.displayOrder
        });
        setError('');
    };

    const handleSave = async () => {
        try {
            setError('');

            // Validaciones
            if (!formData.name || !formData.baseUrl || !formData.imageUrl) {
                setError('Todos los campos son obligatorios');
                return;
            }

            if (!/^[a-zA-Z0-9_-]+$/.test(formData.name)) {
                setError('El nombre solo puede contener letras, números, guiones y guiones bajos');
                return;
            }

            if (formData.name.length > 20) {
                setError('El nombre no puede exceder 20 caracteres');
                return;
            }

            if (editingButton) {
                // Actualizar botón existente
                const updated = await externalButtonsAPI.update(editingButton.id, formData);
                setExternalButtons(prev => prev.map(b => b.id === editingButton.id ? updated : b));
            } else {
                // Crear nuevo botón
                if (externalButtons.length >= 3) {
                    setError('Máximo 3 botones permitidos. Elimina uno antes de agregar otro.');
                    return;
                }

                // Calcular el próximo displayOrder disponible
                const nextOrder = externalButtons.length > 0
                    ? Math.max(...externalButtons.map(b => b.displayOrder)) + 1
                    : 1;

                const created = await externalButtonsAPI.create(
                    formData.name,
                    formData.baseUrl,
                    formData.imageUrl,
                    nextOrder
                );
                setExternalButtons(prev => [...prev, created]);
            }

            resetForm();
        } catch (err) {
            setError(err.message || 'Error al guardar el botón');
        }
    };

    const handleDelete = async (buttonId) => {
        if (!window.confirm('¿Eliminar este botón externo?')) return;

        try {
            await externalButtonsAPI.delete(buttonId);
            setExternalButtons(prev => prev.filter(b => b.id !== buttonId));
            resetForm();
        } catch (err) {
            setError(err.message || 'Error al eliminar el botón');
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    if (!show) return null;

    return (
        <div className="modal" onClick={handleClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <h2>🔗 Botones Externos Personalizados</h2>
                <p style={{ color: '#888', marginBottom: '20px' }}>
                    Configura hasta 3 botones con enlaces externos para tus acciones
                </p>

                {error && (
                    <div style={{
                        padding: '10px',
                        marginBottom: '15px',
                        backgroundColor: '#ff444420',
                        border: '1px solid #ff4444',
                        borderRadius: '4px',
                        color: '#ff4444'
                    }}>
                        {error}
                    </div>
                )}

                {/* Lista de botones existentes */}
                <div style={{ marginBottom: '20px' }}>
                    <h3>Botones Configurados ({externalButtons.length}/3)</h3>
                    {externalButtons.length === 0 ? (
                        <p style={{ color: '#666', fontStyle: 'italic' }}>No hay botones configurados</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {externalButtons.sort((a, b) => a.displayOrder - b.displayOrder).map(button => (
                                <div
                                    key={button.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px',
                                        border: '1px solid #444',
                                        borderRadius: '4px',
                                        backgroundColor: editingButton?.id === button.id ? '#ffffff10' : 'transparent'
                                    }}
                                >
                                    <img
                                        src={button.imageUrl}
                                        alt={button.name}
                                        style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover' }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold' }}>{button.name}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>{button.baseUrl}</div>
                                    </div>
                                    <button
                                        className="button"
                                        onClick={() => handleEdit(button)}
                                        style={{ fontSize: '12px', padding: '4px 8px' }}
                                    >
                                        ✏️ Editar
                                    </button>
                                    <button
                                        className="button danger"
                                        onClick={() => handleDelete(button.id)}
                                        style={{ fontSize: '12px', padding: '4px 8px' }}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Formulario de creación/edición */}
                <div style={{ padding: '15px', border: '1px solid #444', borderRadius: '4px', backgroundColor: '#ffffff05' }}>
                    <h3>{editingButton ? 'Editar Botón' : 'Crear Nuevo Botón'}</h3>

                    <div style={{ marginBottom: '15px' }}>
                        <label htmlFor="button-name">Nombre del campo (ej: "inest", "yahoo"):</label>
                        <input
                            id="button-name"
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Investing (simbolo)"
                            maxLength={20}
                            style={{ width: '100%' }}
                        />
                        <small style={{ color: '#888' }}>Solo letras, números, guiones. Máx 20 caracteres.</small>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label htmlFor="button-url">URL base:</label>
                        <input
                            id="button-url"
                            type="url"
                            value={formData.baseUrl}
                            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                            placeholder="ejemplo: https://investing.com"
                            style={{ width: '100%' }}
                        />
                        <small style={{ color: '#888' }}>El símbolo se concatenará al final de esta URL</small>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label htmlFor="button-image">URL de la imagen:</label>
                        <input
                            id="button-image"
                            type="text"
                            value={formData.imageUrl}
                            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                            placeholder="ejemplo: https://investing.com/investing.webp"
                            style={{ width: '100%' }}
                        />
                        <small style={{ color: '#888' }}>
                            Ruta relativa (ej: /investing.webp) o URL completa
                        </small>
                        {formData.imageUrl && (
                            <div style={{ marginTop: '10px' }}>
                                <strong>Vista previa:</strong>
                                <div style={{ marginTop: '5px' }}>
                                    <img
                                        src={formData.imageUrl}
                                        alt="Preview"
                                        style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="button success" onClick={handleSave}>
                            {editingButton ? '💾 Actualizar' : '➕ Crear'}
                        </button>
                        {editingButton && (
                            <button className="button" onClick={resetForm}>
                                ❌ Cancelar
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="button" onClick={handleClose}>
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ExternalButtonsModal;
