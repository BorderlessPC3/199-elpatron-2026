import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import './PageTransition.css'

interface PageTransitionProps {
  children: ReactNode
  isTransitioning: boolean
  onTransitionComplete?: () => void
}

function PageTransition({ children, isTransitioning, onTransitionComplete }: PageTransitionProps) {
  const [shouldRender, setShouldRender] = useState(true)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isEntering, setIsEntering] = useState(false)
  const [isEntered, setIsEntered] = useState(true)

  useEffect(() => {
    if (isTransitioning) {
      // Iniciar animação de saída
      setIsAnimating(true)
      setIsEntering(false)
      setIsEntered(false)
      
      const exitTimer = setTimeout(() => {
        setShouldRender(false)
        setIsAnimating(false)
        
        // Pequeno delay antes de mostrar nova página
        const enterTimer = setTimeout(() => {
          setShouldRender(true)
          setIsEntering(true)
          
          // Animar entrada da nova página
          const finalTimer = setTimeout(() => {
            setIsEntering(false)
            setIsEntered(true)
            if (onTransitionComplete) {
              onTransitionComplete()
            }
          }, 50)
          
          return () => clearTimeout(finalTimer)
        }, 100)
        
        return () => clearTimeout(enterTimer)
      }, 200)
      
      return () => clearTimeout(exitTimer)
    } else {
      // Página estável
      setShouldRender(true)
      setIsAnimating(false)
      setIsEntering(false)
      setIsEntered(true)
    }
  }, [isTransitioning, onTransitionComplete])

  if (!shouldRender) {
    return null
  }

  const getTransitionClass = () => {
    if (isAnimating) return 'animating'
    if (isEntering) return 'entering'
    if (isEntered) return 'entered'
    return ''
  }

  return (
    <div className={`page-transition ${getTransitionClass()}`}>
      {children}
    </div>
  )
}

export default PageTransition 