import { useState, useEffect, useCallback } from 'react'
import { pricesAPI, configAPI } from '../services/api.js'

export function useLivePrices({ finnhubApiKey, getActivePositions, fetchPriceFromYahoo }) {
  const [currentPrices, setCurrentPrices] = useState({})
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [loadingPrices, setLoadingPrices] = useState(false)

  const refreshPrices = useCallback(async () => {
    const activePositions = getActivePositions()
    const positionKeys = Object.keys(activePositions)

    if (positionKeys.length === 0) {
      setCurrentPrices({})
      return
    }

    setLoadingPrices(true)
    try {
      // 1. Indicar al servidor que actualice todos los precios en la base de datos
      await pricesAPI.refreshAll()

      // 2. Obtener los nuevos precios desde la base de datos
      const res = await pricesAPI.getBulk(positionKeys)
      const updatedPrices = {}
      let maxUpdatedAt = null

      Object.entries(res.prices || {}).forEach(([key, p]) => {
        updatedPrices[key] = {
          price: p.price,
          change: p.change ?? 0,
          changePercent: p.changePercent ?? 0,
          source: p.source || 'cache',
          updatedAt: p.updatedAt
        }

        if (p.updatedAt) {
          const dt = new Date(p.updatedAt)
          if (!isNaN(dt.valueOf()) && (!maxUpdatedAt || dt > maxUpdatedAt)) {
            maxUpdatedAt = dt
          }
        }
      })

      setCurrentPrices(updatedPrices)
      if (maxUpdatedAt) setLastUpdatedAt(maxUpdatedAt)

      // Actualizar el marcador local del scheduler para evitar que el efecto de polling 
      // intente recargar lo que acabamos de traer
      const schedulerLastRun = await configAPI.get('scheduler_last_run')
      if (schedulerLastRun?.value) {
        localStorage.setItem('scheduler_last_run', schedulerLastRun.value)
      }

    } catch (error) {
      console.error('Error refreshing prices:', error)
    } finally {
      setLoadingPrices(false)
    }
  }, [getActivePositions])

  useEffect(() => {
    let timer

    const checkSchedulerUpdates = async () => {
      try {
        const schedulerLastRun = await configAPI.get('scheduler_last_run')
        const currentLastRun = localStorage.getItem('scheduler_last_run')

        if (schedulerLastRun?.value && schedulerLastRun.value !== currentLastRun) {
          localStorage.setItem('scheduler_last_run', schedulerLastRun.value)

          const activePositions = getActivePositions()
          const positionKeys = Object.keys(activePositions)

          if (positionKeys.length === 0) return

          const res = await pricesAPI.getBulk(positionKeys)
          const updatedPrices = {}
          let maxUpdatedAt = null

          Object.entries(res.prices || {}).forEach(([key, p]) => {
            updatedPrices[key] = {
              price: p.price,
              change: p.change ?? null,
              changePercent: p.changePercent ?? null,
              source: p.source || 'cache',
              updatedAt: p.updatedAt
            }

            if (p.updatedAt) {
              const dt = new Date(p.updatedAt)
              if (!isNaN(dt.valueOf()) && (!maxUpdatedAt || dt > maxUpdatedAt)) {
                maxUpdatedAt = dt
              }
            }
          })

          setCurrentPrices(prev => ({ ...prev, ...updatedPrices }))
          if (maxUpdatedAt) setLastUpdatedAt(maxUpdatedAt)
        }
      } catch (e) {
      }
    }

    timer = setInterval(checkSchedulerUpdates, 30000)
    return () => { if (timer) clearInterval(timer) }
  }, [getActivePositions])

  return { currentPrices, setCurrentPrices, lastUpdatedAt, setLastUpdatedAt, loadingPrices, refreshPrices }
}
