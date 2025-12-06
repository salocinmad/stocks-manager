import { useState, useEffect, useCallback } from 'react'
import { pricesAPI, configAPI } from '../services/api.js'

export function useLivePrices({ finnhubApiKey, getActivePositions, fetchPriceFromYahoo }) {
  const [currentPrices, setCurrentPrices] = useState({})
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [loadingPrices, setLoadingPrices] = useState(false)

  const refreshPrices = useCallback(async () => {
    const activePositions = getActivePositions()
    const companies = Object.keys(activePositions)

    if (companies.length === 0) {
      setCurrentPrices({})
      return
    }

    setLoadingPrices(true)
    const prices = {}

    const positionSymbols = {}
    companies.forEach(positionKey => {
      const position = activePositions[positionKey]
      if (position && position.symbol) {
        positionSymbols[positionKey] = position.symbol
      }
    })

    const pricePromises = companies.map(async (positionKey) => {
      const symbol = positionSymbols[positionKey]
      if (!symbol) {
        return { positionKey, priceData: null }
      }

      const position = activePositions[positionKey]
      const companyName = position?.company || positionKey.split('|||')[0]

      try {
        let symbolInput = symbol.toUpperCase().trim()
        let symbolPart = symbolInput
        let exchangePart = ''

        if (symbolInput.includes(':')) {
          const parts = symbolInput.split(':')
          symbolPart = parts[0]
          exchangePart = parts[1]
        }

        let priceData = null

        let finnhubExchange = exchangePart
        if (finnhubExchange) {
          const exchangeUpper = finnhubExchange.toUpperCase()
          if (exchangeUpper === 'MC' || exchangeUpper === 'BME') {
            finnhubExchange = 'BME'
          } else if (exchangeUpper === 'F' || exchangeUpper === 'FRA') {
            finnhubExchange = 'FRA'
          }
        }

        let yahooExchange = exchangePart
        if (yahooExchange) {
          const exchangeUpper = yahooExchange.toUpperCase()
          if (exchangeUpper === 'FRA') {
            yahooExchange = 'F'
          } else if (exchangeUpper === 'BME') {
            yahooExchange = 'MC'
          }
        }

        if (finnhubApiKey) {
          try {
            const finnhubSymbol = finnhubExchange ? `${symbolPart}.${finnhubExchange}` : symbolPart
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000)

            const response = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${finnhubSymbol}&token=${finnhubApiKey}`,
              { signal: controller.signal }
            )

            clearTimeout(timeoutId)

            if (response.ok) {
              const data = await response.json()
              if (data.c && data.c > 0) {
                priceData = {
                  price: data.c,
                  change: data.d,
                  changePercent: data.dp,
                  symbol: finnhubSymbol,
                  source: 'finnhub',
                  updatedAt: new Date().toISOString()
                }
              }
            }
          } catch (error) {
            if (error.name !== 'AbortError') {
            }
          }
        }

        if (!priceData) {
          try {
            const yahooPromise = fetchPriceFromYahoo(symbolPart, yahooExchange)
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout después de 15 segundos')), 15000)
            )

            priceData = await Promise.race([yahooPromise, timeoutPromise])

            if (priceData) {
              priceData.source = 'yahoo'
              priceData.updatedAt = new Date().toISOString()
            }
          } catch (error) {
          }
        }

        if (priceData && typeof priceData.price === 'number') {
          try {
            await pricesAPI.upsert(positionKey, {
              price: priceData.price,
              change: priceData.change ?? null,
              changePercent: priceData.changePercent ?? null,
              source: priceData.source
            })
          } catch (e) {
          }
        }

        return { positionKey, priceData }
      } catch (error) {
        return { positionKey, priceData: null }
      }
    })

    const results = await Promise.allSettled(pricePromises)
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        const { positionKey, priceData } = result.value
        if (priceData) {
          prices[positionKey] = priceData
        }
      }
    })

    setCurrentPrices(prices)
    setLoadingPrices(false)

    const nowIso = new Date().toISOString()
    setLastUpdatedAt(new Date(nowIso))
    try {
      await configAPI.set('last_prices_sync_at', nowIso)
    } catch (e) {
    }
  }, [finnhubApiKey, getActivePositions, fetchPriceFromYahoo])

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
