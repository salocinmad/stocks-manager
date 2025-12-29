import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import MDEditor from '@uiw/react-md-editor';

interface StockNoteModalProps {
    positionId: string;
    ticker: string;
    onClose: () => void;
}

export const StockNoteModal: React.FC<StockNoteModalProps> = ({ positionId, ticker, onClose }) => {
    const { api } = useAuth();
    const [content, setContent] = useState<string>('');
    const [originalContent, setOriginalContent] = useState<string>('');
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasNote, setHasNote] = useState(false);

    // Cargar nota existente
    useEffect(() => {
        const loadNote = async () => {
            try {
                const { data } = await api.get(`/notes/${positionId}`);
                if (data.note) {
                    setContent(data.note.content);
                    setOriginalContent(data.note.content);
                    setHasNote(true);
                    setIsEditing(false);
                } else {
                    setIsEditing(true); // Sin nota, abrir editor directamente
                }
            } catch (error) {
                console.error('Error loading note:', error);
                setIsEditing(true);
            } finally {
                setIsLoading(false);
            }
        };
        loadNote();
    }, [api, positionId]);

    // Handler para ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Guardar nota
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await api.put(`/notes/${positionId}`, { content });
            setOriginalContent(content);
            setHasNote(true);
            setIsEditing(false);
        } catch (error) {
            console.error('Error saving note:', error);
            alert('Error al guardar la nota');
        } finally {
            setIsSaving(false);
        }
    };

    // Cancelar edición
    const handleCancel = () => {
        if (hasNote) {
            setContent(originalContent);
            setIsEditing(false);
        } else {
            onClose();
        }
    };

    // Subir imagen desde portapapeles
    const handlePaste = useCallback(async (event: React.ClipboardEvent) => {
        const items = event.clipboardData?.items;
        if (!items) return;

        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                event.preventDefault();
                const file = item.getAsFile();
                if (!file) continue;

                const formData = new FormData();
                formData.append('image', file);

                try {
                    const { data } = await api.post('/notes/upload-image', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });

                    if (data.url) {
                        // Insertar imagen en markdown
                        setContent(prev => `${prev}\n![imagen](${data.url})\n`);
                    }
                } catch (error) {
                    console.error('Error uploading image:', error);
                    alert('Error al subir la imagen');
                }
                break;
            }
        }
    }, [api]);

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-black/40">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-black/40 animate-in fade-in duration-200">
            <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-surface-dark rounded-[2rem] border border-border-light dark:border-border-dark shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark">
                    <h3 className="text-xl font-bold flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">description</span>
                        Nota para {ticker}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-background-light dark:hover:bg-white/10 transition-colors"
                        title="Cerrar (ESC)"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6" onPaste={isEditing ? handlePaste : undefined}>
                    {isEditing ? (
                        <div data-color-mode="dark">
                            <MDEditor
                                value={content}
                                onChange={(val) => setContent(val || '')}
                                height={400}
                                preview="live"
                                textareaProps={{
                                    placeholder: 'Escribe tu nota aquí... (Puedes pegar imágenes con Ctrl+V)'
                                }}
                            />
                        </div>
                    ) : (
                        <div className="prose dark:prose-invert max-w-none">
                            <MDEditor.Markdown source={content} />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-border-light dark:border-border-dark">
                    {isEditing ? (
                        <>
                            <button
                                onClick={handleCancel}
                                className="px-6 py-3 rounded-xl border border-border-light dark:border-border-dark font-bold hover:bg-background-light dark:hover:bg-white/5 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-6 py-3 rounded-xl bg-primary text-black font-bold hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
                            >
                                {isSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="px-6 py-3 rounded-xl bg-primary text-black font-bold hover:scale-105 transition-all flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">edit</span>
                            Editar Nota
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
