import { useState, useEffect, useCallback } from 'react'
import { authenticatedFetch } from '../services/auth.js'

export function useEurUsdRate({ autoLoad = true, defaultRate = 0.92 } = {}) {
  const [currentEURUSD, setCurrentEURUSD] = useState(null)
  const [source, setSource] = useState('')

  const refresh = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/yahoo/fx/eurusd')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Error al obtener tipo de cambio')
      }
      const data = await response.json()
      const eurPerUsd = Number(data.eurPerUsd)
      if (!eurPerUsd || eurPerUsd <= 0) throw new Error('Tipo de cambio inválido')
      setCurrentEURUSD(eurPerUsd)
      setSource(String(data.source || ''))
      return eurPerUsd
    } catch (error) {
      const fallback = currentEURUSD || defaultRate
      setCurrentEURUSD(fallback)
      setSource('cache')
      return fallback
    }
  }, [currentEURUSD, defaultRate])

  useEffect(() => {
    if (autoLoad) {
      refresh()
    }
  }, [autoLoad, refresh])

  return { currentEURUSD, source, refresh }
}

