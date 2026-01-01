import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { RefreshCw, Plus, Trash2, Edit, Save, X, Server, Shield, Globe } from 'lucide-react';

interface AIProvider {
    id: string;
    slug: string;
    name: string;
    type: string;
    base_url?: string;
    models_endpoint?: string;
    requires_api_key: boolean;
    is_system: boolean;
    is_active: boolean;
}

export const AIProviders: React.FC = () => {
    const { api } = useAuth();
    const [providers, setProviders] = useState<AIProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form States
    const [formData, setFormData] = useState<Partial<AIProvider> & { api_key?: string }>({
        name: '', slug: '', base_url: '', models_endpoint: '/models', requires_api_key: true
    });

    const loadProviders = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/ai/providers');
            setProviders(data);
        } catch (error) {
            console.error('Error loading providers:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProviders();
    }, []);

    const handleCreate = async () => {
        try {
            await api.post('/admin/ai/providers', formData);
            setIsCreating(false);
            setFormData({ name: '', slug: '', base_url: '', models_endpoint: '/models', requires_api_key: true });
            loadProviders();
        } catch (e: any) {
            alert(e.response?.data?.message || 'Error al crear proveedor');
        }
    };

    const handleUpdate = async (id: string) => {
        try {
            await api.put(`/admin/ai/providers/${id}`, formData);
            setEditingId(null);
            loadProviders();
        } catch (e: any) {
            alert(e.response?.data?.message || 'Error al actualizar');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este proveedor?')) return;
        try {
            await api.delete(`/admin/ai/providers/${id}`);
            loadProviders();
        } catch (e: any) {
            alert(e.response?.data?.message || 'Error al eliminar');
        }
    };

    const startEdit = (p: AIProvider) => {
        setFormData({ ...p });
        setEditingId(p.id);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <Server size={20} />
                    Proveedores de IA
                </h3>
                <button
                    onClick={() => setIsCreating(true)}
                    className="px-3 py-2 bg-primary text-black rounded-lg text-sm font-bold flex items-center gap-2"
                >
                    <Plus size={16} /> Nuevo Proveedor
                </button>
            </div>

            {/* Creating Form */}
            {isCreating && (
                <div className="bg-background-light dark:bg-surface-dark-elevated p-4 rounded-xl border border-border-light dark:border-border-dark mb-4 animate-fade-in">
                    <h4 className="font-bold mb-4">Nuevo Proveedor Custom</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <input
                            placeholder="Nombre (ej. Mi Ollama)"
                            className="p-2 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                        <input
                            placeholder="Slug (ID único, ej. my-ollama)"
                            className="p-2 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark"
                            value={formData.slug}
                            onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                        />
                        <input
                            placeholder="Base URL (ej. http://localhost:11434/v1)"
                            className="p-2 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark md:col-span-2"
                            value={formData.base_url}
                            onChange={e => setFormData({ ...formData, base_url: e.target.value })}
                        />
                        <input
                            placeholder="Endpoint Modelos (ej. /models o /api/tags)"
                            className="p-2 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark md:col-span-2"
                            value={formData.models_endpoint}
                            onChange={e => setFormData({ ...formData, models_endpoint: e.target.value })}
                        />
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.requires_api_key}
                                onChange={e => setFormData({ ...formData, requires_api_key: e.target.checked })}
                            />
                            Requiere API Key
                        </label>
                        {formData.requires_api_key && (
                            <input
                                type="password"
                                placeholder="API Key (Opcional al crear)"
                                className="p-2 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark"
                                onChange={e => setFormData({ ...formData, api_key: e.target.value })} // Note: I need to add api_key to state type or interface
                            />
                        )}
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setIsCreating(false)} className="px-3 py-1 text-sm">Cancelar</button>
                        <button onClick={handleCreate} className="px-3 py-1 bg-primary text-black rounded-lg text-sm font-bold">Crear</button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="grid gap-4">
                {providers.map(p => (
                    <div key={p.id} className="bg-surface-light dark:bg-surface-dark-elevated p-4 rounded-xl border border-border-light dark:border-border-dark flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        {editingId === p.id ? (
                            <div className="w-full space-y-3">
                                <div className="flex gap-2">
                                    <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="flex-1 p-2 rounded border dark:bg-surface-dark dark:border-gray-700" />
                                    <input value={formData.base_url} onChange={e => setFormData({ ...formData, base_url: e.target.value })} placeholder="Base URL" className="flex-1 p-2 rounded border dark:bg-surface-dark dark:border-gray-700" />
                                </div>
                                <div className="flex gap-2">
                                    <input value={formData.models_endpoint} onChange={e => setFormData({ ...formData, models_endpoint: e.target.value })} placeholder="Models Endpoint" className="flex-1 p-2 rounded border dark:bg-surface-dark dark:border-gray-700" />
                                    <label className="flex items-center gap-2 px-2 border rounded dark:border-gray-700">
                                        <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                                        Habilitado
                                    </label>
                                </div>
                                {p.requires_api_key && (
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            placeholder="Nueva API Key (Dejar vacío para no cambiar)"
                                            className="flex-1 p-2 rounded border dark:bg-surface-dark dark:border-gray-700 bg-yellow-500/5 border-yellow-500/20"
                                            onChange={e => setFormData({ ...formData, api_key: e.target.value })}
                                        />
                                    </div>
                                )}
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setEditingId(null)} className="p-2 text-red-500"><X size={18} /></button>
                                    <button onClick={() => handleUpdate(p.id)} className="p-2 text-green-500"><Save size={18} /></button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${p.is_system ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>
                                        {p.is_system ? <Shield size={20} /> : <Globe size={20} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold">{p.name}</h4>
                                            {p.is_active && <span className="text-[10px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full">HABILITADO</span>}
                                        </div>
                                        <div className="text-xs text-text-secondary-light flex flex-col">
                                            <span>{p.base_url || 'URL Interna/SDK'}</span>
                                            <span className="opacity-70">Tipo: {p.type} | Slug: {p.slug}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button onClick={() => startEdit(p)} className="p-2 hover:bg-background-light dark:hover:bg-surface-dark rounded-lg transition-colors" title="Editar">
                                        <Edit size={18} className="text-text-secondary-light" />
                                    </button>
                                    {!p.is_system && (
                                        <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar">
                                            <Trash2 size={18} className="text-red-500" />
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
