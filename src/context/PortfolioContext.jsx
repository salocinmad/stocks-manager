import { createContext, useContext, useEffect, useState } from 'react'
import { portfolioAPI } from '../services/api.js'

const PortfolioContext = createContext(null)

export function PortfolioProvider({ children }) {
  const [portfolios, setPortfolios] = useState([])
  const [currentPortfolioId, setCurrentPortfolioId] = useState(null)

  useEffect(() => {
    const init = async () => {
      try {
        const list = await portfolioAPI.list()
        const items = Array.isArray(list?.items) ? list.items : []
        setPortfolios(items)
        const stored = localStorage.getItem('currentPortfolioId')
        let pid = stored ? parseInt(stored, 10) : null
        const valid = items.some(p => p.id === pid)
        if (!valid) {
          pid = items[0]?.id || null
        }
        if (!pid && items.length === 0) {
          const created = await portfolioAPI.create('Principal')
          pid = created?.item?.id || null
          await portfolioAPI.setFavorite(pid)
        }
        if (pid) {
          localStorage.setItem('currentPortfolioId', String(pid))
          setCurrentPortfolioId(pid)
        }
      } catch { }
    }
    init()
  }, [])

  const switchPortfolio = async (id) => {
    const pid = parseInt(id, 10)
    const exists = portfolios.some(p => p.id === pid)
    if (!exists) return
    localStorage.setItem('currentPortfolioId', String(pid))
    setCurrentPortfolioId(pid)
  }

  const markFavorite = async (id) => {
    try {
      await portfolioAPI.setFavorite(id)
      localStorage.setItem('currentUserFavorite', String(id))
    } catch { }
  }

  const reloadPortfolios = async () => {
    try {
      const list = await portfolioAPI.list()
      const items = Array.isArray(list?.items) ? list.items : []
      setPortfolios(items)
    } catch { }
  }

  return (
    <PortfolioContext.Provider value={{ portfolios, currentPortfolioId, switchPortfolio, markFavorite, reloadPortfolios }}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  return useContext(PortfolioContext)
}

