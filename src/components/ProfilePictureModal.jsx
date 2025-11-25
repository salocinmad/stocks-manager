import React, { useState } from 'react';
import { profilePicturesAPI } from '../services/api';

function ProfilePictureModal({ show, onClose, onUploadSuccess, onDeleteSuccess, currentProfilePictureUrl, fetchProfilePicture }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  if (!show) {
    return null;
  }

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setError('');
    setMessage('');
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Por favor, selecciona una imagen para subir.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      await profilePicturesAPI.upload(selectedFile);
      setMessage('Imagen de perfil subida/actualizada correctamente.');
      setSelectedFile(null);
      await fetchProfilePicture(); // Refrescar la imagen en App.jsx
      onUploadSuccess(); // Callback para App.jsx
    } catch (err) {
      console.error('Error al subir la imagen:', err);
      setError(err.message || 'Error al subir la imagen.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar tu imagen de perfil?')) {
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      await profilePicturesAPI.delete();
      setMessage('Imagen de perfil eliminada correctamente.');
      await fetchProfilePicture(); // Refrescar la imagen en App.jsx
      onDeleteSuccess(); // Callback para App.jsx
    } catch (err) {
      console.error('Error al eliminar la imagen:', err);
      setError(err.message || 'Error al eliminar la imagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
      <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
        <h3 className="text-lg font-bold mb-4">Gestionar Imagen de Perfil</h3>

        {currentProfilePictureUrl && (
          <div className="mb-4 text-center">
            <p className="text-sm mb-2">Imagen actual:</p>
            <img
              src={currentProfilePictureUrl}
              alt="Current Profile"
              className="w-24 h-24 rounded-full object-cover mx-auto border-2 border-gray-300 dark:border-gray-600"
            />
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="profilePictureInput" className="block text-sm font-medium mb-2">
            Subir nueva imagen:
          </label>
          <input
            type="file"
            id="profilePictureInput"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-900 dark:text-gray-200
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-full file:border-0
                       file:text-sm file:font-semibold
                       file:bg-blue-50 file:text-blue-700
                       hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300 dark:hover:file:bg-blue-800"
          />
        </div>

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        {message && <p className="text-green-500 text-sm mb-2">{message}</p>}

        <div className="flex justify-end space-x-2">
          <button
            onClick={handleUpload}
            disabled={loading || !selectedFile}
            className="px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Subiendo...' : 'Subir Imagen'}
          </button>
          <button
            onClick={handleDelete}
            disabled={loading || !currentProfilePictureUrl || currentProfilePictureUrl.includes('gravatar.com')} // Deshabilitar si no hay imagen o es la por defecto
            className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
          >
            Eliminar Imagen
          </button>
          <button
            onClick={() => {
              onClose();
              setSelectedFile(null); // Limpiar el archivo seleccionado al cerrar
              setError('');
              setMessage('');
            }}
            className="px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfilePictureModal;