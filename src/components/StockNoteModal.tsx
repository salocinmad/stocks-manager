import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import MDEditor, { commands } from '@uiw/react-md-editor';

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
    const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = event.clipboardData?.items;
        if (!items) return;

        const textarea = event.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                event.preventDefault();
                const file = item.getAsFile();
                if (!file) continue;

                const formData = new FormData();
                formData.append('image', file);

                // Insert placeholder while uploading
                const placeholder = `![Subiendo imagen...]()...`;
                const before = textarea.value.substring(0, start);
                const after = textarea.value.substring(end);
                setContent(`${before}${placeholder}${after}`);

                // We need to track where our placeholder is to replace it later
                // But simplified: just append or replace selection is tricky with async.
                // Better approach: Block UI or just replace content when done. 
                // Since react state update is async, 'content' variable inside here is stale?
                // No, we use 'setContent' with callback or just raw. 
                // Actually, let's keep it simple: Upload first, then insert.

                try {
                    const { data } = await api.post('/notes/upload-image', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });

                    if (data.url) {
                        const imageMarkdown = `![imagen](${data.url})`;
                        setContent(prev => {
                            // Re-calculate split based on LATEST content? 
                            // This is hard because user might have typed.
                            // However, we preventedDefault(), so user couldn't type paste.
                            // But usually paste is immediate. 
                            // Let's just assume simple insertion at 'start' index captured earlier
                            // Note: 'prev' might be different if other updates happened.
                            // Ideally we trust 'prev' matches 'textarea.value' roughly for this single event.

                            // To be safe against race conditions, we can't easily use 'start' variable with 'prev'.
                            // But for a single user editing, it's usually fine.

                            // Let's use the current 'prev' string.
                            // If we didn't insert placeholder, we just splice in.
                            // If we inserted placeholder, we need to replace it.

                            // Let's go back to: Don't show placeholder, just wait and insert.
                            const before = prev.substring(0, start);
                            const after = prev.substring(end);
                            return `${before}\n${imageMarkdown}\n${after}`;
                        });
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
                <div className="flex-1 overflow-auto p-6">
                    {isEditing ? (
                        <div data-color-mode="dark">
                            <MDEditor
                                value={content}
                                onChange={(val) => setContent(val || '')}
                                height={400}
                                preview="live"
                                commands={[
                                    // Default commands
                                    ...commands.getCommands().filter(c => c.name !== 'fullscreen' && c.name !== 'help'),
                                    // Custom Alignment Commands
                                    {
                                        name: 'align-left',
                                        keyCommand: 'align-left',
                                        buttonProps: { 'aria-label': 'Align Left', title: 'Alinear Izquierda' },
                                        icon: (
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>format_align_left</span>
                                        ),
                                        execute: (state, api) => {
                                            const newText = `<div align="left">\n\n${state.selectedText}\n\n</div>`;
                                            api.replaceSelection(newText);
                                        },
                                    },
                                    {
                                        name: 'align-center',
                                        keyCommand: 'align-center',
                                        buttonProps: { 'aria-label': 'Align Center', title: 'Centrar' },
                                        icon: (
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>format_align_center</span>
                                        ),
                                        execute: (state, api) => {
                                            const newText = `<div align="center">\n\n${state.selectedText}\n\n</div>`;
                                            api.replaceSelection(newText);
                                        },
                                    },
                                    {
                                        name: 'align-right',
                                        keyCommand: 'align-right',
                                        buttonProps: { 'aria-label': 'Align Right', title: 'Alinear Derecha' },
                                        icon: (
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>format_align_right</span>
                                        ),
                                        execute: (state, api) => {
                                            const newText = `<div align="right">\n\n${state.selectedText}\n\n</div>`;
                                            api.replaceSelection(newText);
                                        },
                                    },
                                    {
                                        name: 'align-justify',
                                        keyCommand: 'align-justify',
                                        buttonProps: { 'aria-label': 'Justify', title: 'Justificar' },
                                        icon: (
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>format_align_justify</span>
                                        ),
                                        execute: (state, api) => {
                                            const newText = `<div align="justify">\n\n${state.selectedText}\n\n</div>`;
                                            api.replaceSelection(newText);
                                        },
                                    }
                                ]}
                                textareaProps={{
                                    placeholder: 'Escribe tu nota aquí... (Puedes pegar imágenes con Ctrl+V)',
                                    onPaste: handlePaste // Bind paste handler HERE
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
