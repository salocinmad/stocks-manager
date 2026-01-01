import React, { useState, useRef } from 'react';
import { AlertCircle, Check } from 'lucide-react';

interface PromptEditorProps {
    type: 'CHATBOT' | 'ANALYSIS';
    initialValue: string;
    onSave: (value: string) => void;
    onCancel?: () => void;
}

const VARIABLES = {
    CHATBOT: [
        { name: '{{USER_MESSAGE}}', desc: 'Último mensaje del usuario (CRÍTICO)' },
        { name: '{{CHAT_HISTORY}}', desc: 'Conversación reciente' },
        { name: '{{MARKET_DATA}}', desc: 'Datos financieros (precios, tendencias)' },
        { name: '{{NEWS_CONTEXT}}', desc: 'Noticias recientes de los símbolos mencionados' },
        { name: '{{USER_CONTEXT}}', desc: 'Info del portafolio y alertas del usuario' }
    ],
    ANALYSIS: [
        { name: '{{PORTFOLIO_CONTEXT}}', desc: 'Resumen de posiciones del usuario (CRÍTICO)' },
        { name: '{{MARKET_CONTEXT}}', desc: 'Datos financieros de los activos' },
        { name: '{{NEWS_CONTEXT}}', desc: 'Noticias recientes de los activos analizados' },
        { name: '{{USER_MESSAGE}}', desc: 'Pregunta específica del usuario' }
    ]
};

const CRITICAL_VARS = {
    CHATBOT: ['{{USER_MESSAGE}}'],
    ANALYSIS: ['{{PORTFOLIO_CONTEXT}}']
};

export const PromptEditor: React.FC<PromptEditorProps> = ({ type, initialValue, onSave, onCancel }) => {
    const [value, setValue] = useState(initialValue);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [warning, setWarning] = useState<string | null>(null);

    const insertVariable = (variable: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const newValue = value.substring(0, start) + variable + value.substring(end);
        setValue(newValue);

        // Restore cursor position after insert
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + variable.length, start + variable.length);
        }, 0);
    };

    const handleSave = () => {
        const missingCritical = CRITICAL_VARS[type].filter(v => !value.includes(v));

        if (missingCritical.length > 0) {
            setWarning(`Faltan variables críticas: ${missingCritical.join(', ')}. La IA podría fallar.`);
            return;
        }

        onSave(value);
    };

    const confirmSave = () => {
        setWarning(null);
        onSave(value);
    };

    return (
        <div className="w-full h-full flex flex-col bg-background-light dark:bg-surface-dark rounded-xl">
            {/* Header */}
            <div className="pb-3 border-b border-border mb-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span>Editor de Prompt: {type === 'CHATBOT' ? 'Chatbot' : 'Análisis'}</span>
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/20 text-text-primary-light dark:text-gray-200 border border-primary/30">
                            {type}
                        </span>
                    </h3>
                </div>

                {/* Variable Legend */}
                <div className="mb-3 bg-secondary/20 dark:bg-black/20 p-3 rounded-lg border border-border/50">
                    <p className="text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider">Variables Disponibles:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                        {VARIABLES[type].map(v => (
                            <div key={v.name} className="flex items-start gap-2 text-xs">
                                <code className="font-mono font-bold text-primary min-w-[140px]">{v.name}</code>
                                <span className="text-text-secondary opacity-80">{v.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-sm text-text-secondary-light dark:text-gray-400 mb-2 font-medium">
                    Haz clic para insertar:
                </p>

                <div className="flex flex-wrap gap-2">
                    {VARIABLES[type].map(v => (
                        <button
                            key={v.name}
                            onClick={() => insertVariable(v.name)}
                            className="text-xs bg-secondary/50 dark:bg-gray-700 hover:bg-secondary dark:hover:bg-gray-600 px-2 py-1.5 rounded-md border border-border transition-colors flex items-center gap-1 font-mono font-bold text-primary shadow-sm"
                            title={v.desc}
                        >
                            {v.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col gap-4 min-h-[300px]">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="flex-1 w-full p-4 font-mono text-sm bg-background/50 dark:bg-black/20 border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-primary-light dark:text-gray-200"
                    placeholder="Escribe tu prompt aquí..."
                />

                {warning && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-md flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-bold text-sm">Advertencia</p>
                            <p className="text-sm">{warning}</p>
                            <div className="mt-2 flex gap-2">
                                <button
                                    className="px-3 py-1.5 text-xs font-bold bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                    onClick={confirmSave}
                                >
                                    Guardar de todos modos
                                </button>
                                <button
                                    className="px-3 py-1.5 text-xs font-bold border border-red-500/30 hover:bg-red-500/10 rounded transition-colors"
                                    onClick={() => setWarning(null)}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!warning && (
                    <div className="flex justify-end gap-2 pt-2">
                        {onCancel && (
                            <button
                                className="px-4 py-2 text-sm font-semibold text-text-secondary-light hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                onClick={onCancel}
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            className="px-4 py-2 text-sm font-bold bg-primary text-black rounded-lg hover:opacity-90 transition-all flex items-center gap-2"
                            onClick={handleSave}
                        >
                            <Check className="w-4 h-4" />
                            Guardar Prompt
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
