import { useState } from 'react';

export function useCompanySearch({ finnhubApiKey, setMissingApiKeyWarning, setShowConfigModal }) {
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchCompanies = async (query) => {
    if (!finnhubApiKey) {
      setMissingApiKeyWarning(true);
      setShowConfigModal(true);
      return;
    }
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }
    setLoadingSearch(true);
    setShowSuggestions(true);
    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${finnhubApiKey}`
      );
      if (!response.ok) {
        throw new Error('Error al buscar empresas');
      }
      const data = await response.json();
      if (data.result && data.result.length > 0) {
        setSearchResults(data.result.slice(0, 30));
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching companies:', error);
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  return { searchResults, setSearchResults, loadingSearch, showSuggestions, setShowSuggestions, searchCompanies };
}
