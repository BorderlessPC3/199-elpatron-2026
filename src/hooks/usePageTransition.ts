import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'

interface UsePageTransitionReturn {
  isTransitioning: boolean
  startTransition: () => void
  endTransition: () => void
}

export function usePageTransition(): UsePageTransitionReturn {
  const [isTransitioning, setIsTransitioning] = useState(false)
  const location = useLocation()

  const startTransition = useCallback(() => {
    setIsTransitioning(true)
  }, [])

  const endTransition = useCallback(() => {
    setIsTransitioning(false)
  }, [])

  // Reset da transição quando a rota muda (tempo otimizado)
  useEffect(() => {
    const timer = setTimeout(() => {
      endTransition()
    }, 250) // Reduzido de 300ms para 250ms

    return () => clearTimeout(timer)
  }, [location.pathname, endTransition])

  return {
    isTransitioning,
    startTransition,
    endTransition
  }
} 