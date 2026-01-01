import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PromptEditor } from '../PromptEditor';
import { RefreshCw, Edit, Trash2, CheckCircle, AlertTriangle, Plus, Terminal } from 'lucide-react';

interface AIProvider {
    id: string;
    slug: string;
    name: string;
    is_active: boolean; // Just visual flag, real active is set via Settings
    is_system: boolean;
}

interface AIModel {
    id: string;
    name: string;
}

interface Prompt {
    id: string;
    name: string;
    prompt_type: 'CHATBOT' | 'ANALYSIS';
    content: string;
    is_active: boolean;
    is_system: boolean;
    created_at: string;
}

export const AIGeneral: React.FC = () => {
    const { api } = useAuth();

    // Config State
    const [activeProviderSlug, setActiveProviderSlug] = useState('');
    const [activeModel, setActiveModel] = useState('');

    // Lists
    const [providers, setProviders] = useState<AIProvider[]>([]);
    const [models, setModels] = useState<AIModel[]>([]);
    const [prompts, setPrompts] = useState<Prompt[]>([]);

    // Loading States
    const [loading, setLoading] = useState(true);
    const [refreshingModels, setRefreshingModels] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    // Prompt Editing State
    const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
    const [creatingType, setCreatingType] = useState<'CHATBOT' | 'ANALYSIS' | null>(null);

    // Initial Load
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                loadSettings(),
                loadProviders(),
                loadModels(), // This fetches models for the CURRENTLY ACTIVE provider in backend
                loadPrompts()
            ]);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        const { data } = await api.get('/admin/settings/ai');
        setActiveProviderSlug(data.provider);
        setActiveModel(data.model);
    };

    const loadProviders = async () => {
        const { data } = await api.get('/admin/ai/providers');
        setProviders(data);
    };

    const loadModels = async () => {
        try {
            const { data } = await api.get('/admin/settings/ai/models');
            setModels(data);
        } catch (e) { console.error('Error loading models', e); }
    };

    const loadPrompts = async () => {
        const { data } = await api.get('/admin/ai/prompts');
        setPrompts(data);
    };

    // Actions
    const handleProviderChange = async (slug: string) => {
        setActiveProviderSlug(slug);
        setRefreshingModels(true);
        try {
            // 1. Set Active Provider
            await api.post('/admin/settings/ai/provider', { providerSlug: slug });

            // 2. Refresh Models (backend will now use new provider)
            // Wait a bit or force refresh?
            // The backend fetchAvailableModels might need a force flag or just call refresh endpoint.
            const { data } = await api.post('/admin/settings/ai/models/refresh');
            setModels(data.models);

            // 3. Reset selected model to first available or default
            if (data.models && data.models.length > 0) {
                const newModel = data.models[0].id;
                setActiveModel(newModel);
                await api.post('/admin/settings/ai', { model: newModel });
            }

        } catch (e: any) {
            alert(e.response?.data?.message || 'Error cambiando proveedor');
        } finally {
            setRefreshingModels(false);
        }
    };

    const handleModelChange = async (modelId: string) => {
        setActiveModel(modelId);
        try {
            await api.post('/admin/settings/ai', { model: modelId });
        } catch (e) { console.error(e); }
    };

    const handleRefreshModels = async () => {
        setRefreshingModels(true);
        try {
            const { data } = await api.post('/admin/settings/ai/models/refresh');
            setModels(data.models);
            alert('Modelos actualizados correctamente');
        } catch (e: any) {
            alert(e.response?.data?.message || 'Error actualizando modelos');
        } finally {
            setRefreshingModels(false);
        }
    };

    const handleActivatePrompt = async (id: string) => {
        try {
            await api.put(`/admin/ai/prompts/${id}/activate`);
            loadPrompts();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleDeletePrompt = async (id: string) => {
        if (!confirm('¿Eliminar prompt?')) return;
        try {
            await api.delete(`/admin/ai/prompts/${id}`);
            loadPrompts();
        } catch (e: any) { alert(e.response?.data?.message || e.message); }
    };

    const handleSaveConfig = async () => {
        setSavingSettings(true);
        try {
            // 1. Save Provider (Just in case)
            await api.post('/admin/settings/ai/provider', { providerSlug: activeProviderSlug });

            // 2. Save Model
            await api.post('/admin/settings/ai', { model: activeModel });

            alert('Configuración de IA guardada y aplicada correctamente.');
        } catch (e: any) {
            alert('Error guardando configuración: ' + (e.response?.data?.message || e.message));
        } finally {
            setSavingSettings(false);
        }
    };

    const handleSavePrompt = async (content: string) => {
        try {
            if (editingPrompt) {
                await api.put(`/admin/ai/prompts/${editingPrompt.id}`, {
                    content,
                    name: editingPrompt.name
                });
                setEditingPrompt(null);
            } else if (creatingType) {
                const name = prompt('Nombre para el nuevo prompt:');
                if (!name) return;
                await api.post('/admin/ai/prompts', {
                    name,
                    prompt_type: creatingType,
                    content
                });
                setCreatingType(null);
            }
            loadPrompts();
        } catch (e: any) {
            alert(e.response?.data?.message || e.message);
        }
    };

    // Render Logic
    if (editingPrompt || creatingType) {
        return (
            <div className="h-[600px] border border-border-light dark:border-border-dark rounded-2xl overflow-hidden shadow-lg">
                <PromptEditor
                    type={editingPrompt?.prompt_type || creatingType || 'CHATBOT'}
                    initialValue={editingPrompt?.content || ''}
                    onSave={handleSavePrompt}
                    onCancel={() => { setEditingPrompt(null); setCreatingType(null); }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* 1. Selector de Motor y Modelo */}
            <div className="bg-surface-light dark:bg-surface-dark-elevated p-6 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Terminal size={20} className="text-primary" />
                    Motor de Inteligencia Artificial
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold uppercase text-text-secondary-light mb-2">Proveedor Activo</label>
                        <select
                            value={activeProviderSlug}
                            onChange={(e) => handleProviderChange(e.target.value)}
                            className="w-full p-3 rounded-xl bg-background-light dark:bg-surface-dark border border-border-light dark:border-border-dark font-medium"
                        >
                            {providers.filter(p => p.is_active).map(p => (
                                <option key={p.slug} value={p.slug}>
                                    {p.name} {p.is_system ? '(Sistema)' : ''}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-text-secondary-light mt-2">
                            Selecciona qué servicio procesará las solicitudes.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-text-secondary-light mb-2 flex justify-between">
                            Modelo
                            <button onClick={handleRefreshModels} disabled={refreshingModels} className="text-primary hover:underline flex items-center gap-1 text-[10px]">
                                {refreshingModels ? <RefreshCw className="animate-spin" size={10} /> : <RefreshCw size={10} />}
                                Actualizar Lista
                            </button>
                        </label>
                        <select
                            value={activeModel}
                            onChange={(e) => handleModelChange(e.target.value)}
                            disabled={refreshingModels}
                            className="w-full p-3 rounded-xl bg-background-light dark:bg-surface-dark border border-border-light dark:border-border-dark font-mono text-sm"
                        >
                            {models.map(m => (
                                <option key={m.id} value={m.id}>{m.name || m.id}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-6 flex justify-end border-t border-border-light dark:border-border-dark pt-4">
                    <button
                        onClick={handleSaveConfig}
                        disabled={savingSettings}
                        className="px-6 py-3 bg-primary text-black font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
                    >
                        {savingSettings ? <RefreshCw className="animate-spin" size={20} /> : <span className="material-symbols-outlined">save</span>}
                        Guardar Configuración
                    </button>
                </div>
            </div>

            {/* 2. Prompts Management */}
            <div>
                <h3 className="text-lg font-bold mb-6">Gestión de Personalidad y Prompts</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* ChatBot Column */}
                    <div className="bg-surface-light dark:bg-surface-dark-elevated p-1 rounded-2xl border border-border-light dark:border-border-dark flex flex-col h-full">
                        <div className="p-4 border-b border-border-light dark:border-border-dark flex justify-between items-center">
                            <h4 className="font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-green-500">chat</span>
                                ChatBot
                            </h4>
                            <button
                                onClick={() => setCreatingType('CHATBOT')}
                                className="text-xs bg-primary text-black px-3 py-1.5 rounded-lg font-bold hover:opacity-90 transition-opacity flex items-center gap-1"
                            >
                                <Plus size={14} /> Nuevo
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            {prompts.filter(p => p.prompt_type === 'CHATBOT').map(p => (
                                <div key={p.id} className={`p-4 rounded-xl border transition-all relative ${p.is_active
                                    ? 'bg-surface-light dark:bg-background-dark border-primary shadow-[0_0_10px_rgba(255,255,0,0.1)]'
                                    : 'bg-background-light dark:bg-background-dark/50 border-border-light dark:border-border-dark opacity-100'
                                    }`}>

                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <div>
                                            <h5 className={`font-bold text-sm ${p.is_active ? 'text-primary' : ''}`}>{p.name}</h5>
                                            <p className="text-xs text-text-secondary-light mt-1 line-clamp-2 font-mono opacity-80">
                                                {p.content}
                                            </p>
                                        </div>

                                        <div className="flex gap-1 shrink-0">
                                            {p.is_active ? (
                                                <span className="text-[10px] font-bold text-primary flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-full">
                                                    ACTIVO
                                                </span>
                                            ) : (
                                                <button onClick={() => handleActivatePrompt(p.id)} className="p-1.5 hover:bg-surface-light dark:hover:bg-surface-dark rounded-lg transition-colors text-text-secondary-light hover:text-primary" title="Activar">
                                                    <CheckCircle size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border-light/50 dark:border-border-dark/50">
                                        {p.is_system && <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full mr-auto self-center">SISTEMA</span>}

                                        <button onClick={() => setEditingPrompt(p)} className="p-1.5 hover:bg-surface-light dark:hover:bg-surface-dark rounded-lg transition-colors text-text-secondary-light hover:text-white" title="Editar">
                                            <Edit size={14} />
                                        </button>
                                        {!p.is_system && !p.is_active && (
                                            <button onClick={() => handleDeletePrompt(p.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors" title="Eliminar">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Analysis Column */}
                    <div className="bg-surface-light dark:bg-surface-dark-elevated p-1 rounded-2xl border border-border-light dark:border-border-dark flex flex-col h-full">
                        <div className="p-4 border-b border-border-light dark:border-border-dark flex justify-between items-center">
                            <h4 className="font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-purple-500">analytics</span>
                                Análisis
                            </h4>
                            <button
                                onClick={() => setCreatingType('ANALYSIS')}
                                className="text-xs bg-purple-500 text-white px-3 py-1.5 rounded-lg font-bold hover:opacity-90 transition-opacity flex items-center gap-1"
                            >
                                <Plus size={14} /> Nuevo
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            {prompts.filter(p => p.prompt_type === 'ANALYSIS').map(p => (
                                <div key={p.id} className={`p-4 rounded-xl border transition-all relative ${p.is_active
                                    ? 'bg-surface-light dark:bg-background-dark border-primary shadow-[0_0_10px_rgba(255,255,0,0.1)]'
                                    : 'bg-background-light dark:bg-background-dark/50 border-border-light dark:border-border-dark opacity-100'
                                    }`}>

                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <div>
                                            <h5 className={`font-bold text-sm ${p.is_active ? 'text-primary' : ''}`}>{p.name}</h5>
                                            <p className="text-xs text-text-secondary-light mt-1 line-clamp-2 font-mono opacity-80">
                                                {p.content}
                                            </p>
                                        </div>

                                        <div className="flex gap-1 shrink-0">
                                            {p.is_active ? (
                                                <span className="text-[10px] font-bold text-primary flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-full">
                                                    ACTIVO
                                                </span>
                                            ) : (
                                                <button onClick={() => handleActivatePrompt(p.id)} className="p-1.5 hover:bg-surface-light dark:hover:bg-surface-dark rounded-lg transition-colors text-text-secondary-light hover:text-primary" title="Activar">
                                                    <CheckCircle size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border-light/50 dark:border-border-dark/50">
                                        {p.is_system && <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full mr-auto self-center">SISTEMA</span>}

                                        <button onClick={() => setEditingPrompt(p)} className="p-1.5 hover:bg-surface-light dark:hover:bg-surface-dark rounded-lg transition-colors text-text-secondary-light hover:text-white" title="Editar">
                                            <Edit size={14} />
                                        </button>
                                        {!p.is_system && !p.is_active && (
                                            <button onClick={() => handleDeletePrompt(p.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors" title="Eliminar">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
