import React, { useState } from 'react';
import { profilePicturesAPI } from '../services/api.js';

function ProfilePictureModal({ show, onClose, onUploadSuccess, onDeleteSuccess, currentProfilePictureUrl, fetchProfilePicture }) {
  console.log('ProfilePictureModal: currentProfilePictureUrl prop:', currentProfilePictureUrl);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);

  if (!show) return null;

  const resetState = () => {
    setSelectedFile(null);
    setError('');
    setMessage('');
    setDragActive(false);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setError('');
    setMessage('');
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0] || null;
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setError('');
      setMessage('');
    } else {
      setError('Arrastra una imagen válida.');
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Por favor, selecciona o arrastra una imagen.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await profilePicturesAPI.upload(selectedFile);
      setMessage('Imagen de perfil subida/actualizada correctamente.');
            console.log('ProfilePictureModal: Upload success, calling onUploadSuccess');
            onUploadSuccess();
            resetState();
            console.log('ProfilePictureModal: State reset after upload');
    } catch (err) {
      setError(err.message || 'Error al subir la imagen.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar tu imagen de perfil?')) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await profilePicturesAPI.delete();
      setMessage('Imagen de perfil eliminada correctamente.');
      onDeleteSuccess();
      resetState();
    } catch (err) {
      setError(err.message || 'Error al eliminar la imagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>👤 Gestionar Imagen de Perfil</h2>

        {currentProfilePictureUrl && typeof currentProfilePictureUrl === 'string' && (
          <div style={{ marginBottom: '14px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', marginBottom: '6px' }}>Imagen actual</p>
            <img
              src={currentProfilePictureUrl}
              alt="Current Profile"
              style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #404040' }}
            />
          </div>
        )}

        <div className={`dropzone ${dragActive ? 'drag-active' : ''}`} style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '13px', marginBottom: '8px' }}>Arrastra y suelta tu imagen aquí, o selecciónala:</p>
          <input type="file" accept="image/*" onChange={handleFileChange} style={{ marginBottom: '8px' }} />
          {selectedFile && (
            <div style={{ fontSize: '12px', color: '#888' }}>Seleccionado: {selectedFile.name}</div>
          )}
        </div>

        {error && <div className="text-red-500" style={{ fontSize: '12px', marginBottom: '8px' }}>{error}</div>}
        {message && <div className="text-green-500" style={{ fontSize: '12px', marginBottom: '8px' }}>{message}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="button primary" onClick={handleUpload} disabled={loading || !selectedFile} style={{ padding: '8px 16px' }}>
            {loading ? 'Subiendo...' : 'Subir Imagen'}
          </button>
          <button className="button danger" onClick={handleDelete} disabled={loading || !currentProfilePictureUrl} style={{ padding: '8px 16px' }}>
            Eliminar Imagen
          </button>
          <button className="button" onClick={() => { onClose(); resetState(); }} style={{ padding: '8px 16px' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfilePictureModal;
