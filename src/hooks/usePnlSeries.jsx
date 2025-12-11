import { useState, useEffect, useCallback, useRef } from 'react'
import { portfolioAPI } from '../services/api.js'

export function usePnlSeries({ days = 30, computeCurrentNetPnL }) {
  const [pnlSeries, setPnlSeries] = useState([])
  const computeRef = useRef(computeCurrentNetPnL)
  const loadingRef = useRef(false)
  const lastFetchRef = useRef(0)

  useEffect(() => {
    computeRef.current = computeCurrentNetPnL
  }, [computeCurrentNetPnL])

  const refreshSeries = useCallback(async () => {
    if (loadingRef.current) return
    const now = Date.now()
    if (now - lastFetchRef.current < 2000) return
    loadingRef.current = true
    try {
      const ts = await portfolioAPI.timeseries({ days })
      const today = new Date().toISOString().slice(0, 10)
      let series = (ts.items || [])
        .filter(d => d.date !== today)
        .map(d => {
          const value = (typeof d.pnlEUR !== 'undefined') ? d.pnlEUR : d.totalValueEUR
          return { date: d.date, pnlEUR: parseFloat(value || 0) }
        })

      setPnlSeries(series)
    } catch (e) {
    }
    finally {
      lastFetchRef.current = Date.now()
      loadingRef.current = false
    }
  }, [days])

  useEffect(() => {
    refreshSeries()
  }, [days])

  return { pnlSeries, setPnlSeries, refreshSeries }
}
