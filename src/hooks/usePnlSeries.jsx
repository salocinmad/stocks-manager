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
      let series = (ts.items || []).map(d => ({ date: d.date, pnlEUR: parseFloat(d.totalValueEUR || 0) }))

      if (typeof computeRef.current === 'function') {
        const { net, count } = computeRef.current()
        const today = new Date().toISOString().slice(0, 10)
        if (count > 0) {
          const lastPoint = series[series.length - 1]
          if (lastPoint && lastPoint.date === today) {
            series = [...series]
            series[series.length - 1] = { ...series[series.length - 1], pnlEUR: net }
          } else {
            series = [...series, { date: today, pnlEUR: net }]
          }
        }
      }

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
