import { useState, useEffect } from 'react';
import { notesAPI } from '../services/api.js';
import { markdownToHtml as defaultMarkdownToHtml } from '../utils/formatters.js';

export default function NoteModal({
    isOpen,
    onClose,
    positionKey,
    theme,
    notesCache,
    setNotesCache,
    markdownRenderer
}) {
    const [noteContent, setNoteContent] = useState('');
    const [noteOriginalContent, setNoteOriginalContent] = useState('');
    const [noteEditMode, setNoteEditMode] = useState(false);
    const [showMarkdownHelp, setShowMarkdownHelp] = useState(false);
    const [noteLoading, setNoteLoading] = useState(false);
    const [noteSaving, setNoteSaving] = useState(false);

    useEffect(() => {
        if (isOpen && positionKey) {
            const loadNote = async () => {
                try {
                    setNoteLoading(true);
                    const note = await notesAPI.get(positionKey);
                    const content = note?.content || '';
                    setNoteContent(content);
                    setNoteOriginalContent(content);
                    setNoteEditMode(!content || content.trim() === '');
                } catch (e) {
                    setNoteContent('');
                    setNoteOriginalContent('');
                    setNoteEditMode(true);
                } finally {
                    setNoteLoading(false);
                }
            };
            loadNote();
        }
    }, [isOpen, positionKey]);

    const renderMarkdown = (md) => (markdownRenderer || defaultMarkdownToHtml)(md);

    const handleSave = async () => {
        try {
            setNoteSaving(true);
            await notesAPI.upsert(positionKey, noteContent || '');
            setNotesCache(prev => ({ ...prev, [positionKey]: !!(noteContent) }));
            setNoteOriginalContent(noteContent);
            setNoteEditMode(false);
        } catch (e) {
            alert('Error guardando nota');
        } finally {
            setNoteSaving(false);
        }
    };

    const handleCancel = () => {
        setNoteContent(noteOriginalContent);
        if (noteOriginalContent && noteOriginalContent.trim()) {
            setNoteEditMode(false);
        } else {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal">
                <div className="modal-content" style={{ maxWidth: '900px', width: '100%' }}>
                    <h2>📝 Nota</h2>

                    {noteEditMode ? (
                        <div className="form-group" style={{ margin: 0 }}>
                            <label>Markdown</label>
                            <textarea
                                className="input"
                                style={{ minHeight: '300px', width: '100%', resize: 'vertical' }}
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                disabled={noteLoading || noteSaving}
                                placeholder="# Título\n\nEscribe tu nota en Markdown..."
                            />
                        </div>
                    ) : (
                        <div className="card" style={{ width: '100%' }}>
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(noteContent || '') }} />
                        </div>
                    )}

                    <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                        {noteEditMode ? (
                            <>
                                <button
                                    className="button primary"
                                    disabled={noteLoading || noteSaving}
                                    onClick={handleSave}
                                >
                                    Guardar
                                </button>
                                <button
                                    className="button"
                                    onClick={handleCancel}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="button"
                                    onClick={() => setShowMarkdownHelp(true)}
                                    style={{ marginLeft: 'auto' }}
                                    title="Guía de Markdown"
                                >
                                    ❓ Ayuda
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    className="button primary"
                                    onClick={() => setNoteEditMode(true)}
                                >
                                    Editar
                                </button>
                                <button className="button" onClick={onClose}>Cerrar</button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Ayuda Markdown */}
            {showMarkdownHelp && (
                <div className="modal" style={{ zIndex: 10001 }}>
                    <div className="modal-content" style={{ maxWidth: '700px', width: '100%' }}>
                        <h2>📖 Guía Rápida de Markdown</h2>
                        <div className="card" style={{ marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '18px', marginTop: 0 }}>Encabezados</h3>
                            <pre style={{ background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5', color: theme === 'dark' ? '#e8e8e8' : '#333', padding: '10px', borderRadius: '4px', fontSize: '13px', overflowX: 'auto' }}>{`# Título Principal (H1)\n## Título Secundario (H2)\n### Título Terciario (H3)\n#### Subtítulo (H4)`}</pre>
                        </div>

                        <div className="card" style={{ marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '18px', marginTop: 0 }}>Énfasis</h3>
                            <pre style={{ background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5', color: theme === 'dark' ? '#e8e8e8' : '#333', padding: '10px', borderRadius: '4px', fontSize: '13px', overflowX: 'auto' }}>{`**Texto en negrita**\n*Texto en cursiva*`}</pre>
                            <div style={{ marginTop: '8px', fontSize: '14px' }}>
                                <strong>Texto en negrita</strong><br />
                                <em>Texto en cursiva</em>
                            </div>
                        </div>

                        <div className="card" style={{ marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '18px', marginTop: 0 }}>Listas</h3>
                            <pre style={{ background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5', color: theme === 'dark' ? '#e8e8e8' : '#333', padding: '10px', borderRadius: '4px', fontSize: '13px', overflowX: 'auto' }}>{`- Elemento 1\n- Elemento 2\n- Elemento 3`}</pre>
                            <div style={{ marginTop: '8px', fontSize: '14px' }}>
                                <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                    <li>Elemento 1</li>
                                    <li>Elemento 2</li>
                                    <li>Elemento 3</li>
                                </ul>
                            </div>
                        </div>

                        <div className="card" style={{ marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '18px', marginTop: 0 }}>Enlaces</h3>
                            <pre style={{ background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5', color: theme === 'dark' ? '#e8e8e8' : '#333', padding: '10px', borderRadius: '4px', fontSize: '13px', overflowX: 'auto' }}>{`[Texto del enlace](https://ejemplo.com)`}</pre>
                        </div>

                        <div className="card" style={{ marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '18px', marginTop: 0 }}>Código</h3>
                            <pre style={{ background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5', color: theme === 'dark' ? '#e8e8e8' : '#333', padding: '10px', borderRadius: '4px', fontSize: '13px', overflowX: 'auto' }}>{`Código en línea: \`código\`\n\nBloque de código:\n\`\`\`\nfunción ejemplo() {\n  return "Hola";\n}\n\`\`\``}</pre>
                        </div>

                        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                className="button primary"
                                onClick={() => setShowMarkdownHelp(false)}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
