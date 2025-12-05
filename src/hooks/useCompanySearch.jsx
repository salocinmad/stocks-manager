import { useState, useRef } from 'react';
import { authenticatedFetch } from '../services/auth.js';

export function useCompanySearch({ finnhubApiKey, setMissingApiKeyWarning, setShowConfigModal }) {
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const cacheRef = useRef({});

  const searchCompanies = async (query) => {
    const q = query?.trim() || '';
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    if (q.length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    // Comprobar si la consulta está en caché
    if (cacheRef.current[q]) {
      setSearchResults(cacheRef.current[q]);
      setLoadingSearch(false);
      setShowSuggestions(true);
      return;
    }
    setLoadingSearch(true);
    setShowSuggestions(true);
    debounceRef.current = setTimeout(async () => {
      try {
        abortRef.current = new AbortController();
        const r = await authenticatedFetch(`/api/search/companies?q=${encodeURIComponent(q)}`, { signal: abortRef.current.signal });
        if (!r.ok) throw new Error('Error al buscar empresas');
        const data = await r.json();
        const arr = Array.isArray(data.result) ? data.result.slice(0, 30) : [];
        setSearchResults(arr);
        cacheRef.current[q] = arr; // Almacenar en caché
      } catch (error) {
        if (error.name === 'AbortError') {
          // Ignorar errores de aborto, son esperados cuando se cancela una petición
          return;
        }
        setSearchResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);
  };

  return { searchResults, setSearchResults, loadingSearch, showSuggestions, setShowSuggestions, searchCompanies };
}
