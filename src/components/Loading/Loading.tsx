import { useEffect, useRef } from 'react'
import './Loading.css'

interface LoadingProps {
  width?: string
  height?: string
  className?: string
}

interface Pixel {
  x: number
  y: number
  color: string
  speed: number
  size: number
  sizeStep: number
  minSize: number
  maxSizeAvailable: number
  maxSize: number
  sizeDirection: number
  delay: number
  delayHide: number
  counter: number
  counterHide: number
  counterStep: number
  isHidden: boolean
  isFlicking: boolean
}

const rand = (min: number, max: number): number => {
  return Math.random() * (max - min) + min
}

class PixelClass implements Pixel {
  x: number
  y: number
  color: string
  speed: number
  size: number
  sizeStep: number
  minSize: number
  maxSizeAvailable: number
  maxSize: number
  sizeDirection: number
  delay: number
  delayHide: number
  counter: number
  counterHide: number
  counterStep: number
  isHidden: boolean
  isFlicking: boolean

  constructor(x: number, y: number, color: string, speed: number, delay: number, delayHide: number, step: number, boundSize: number) {
    this.x = x
    this.y = y
    this.color = color
    this.speed = rand(0.1, 0.9) * speed
    this.size = 0
    this.sizeStep = rand(0, 0.5)
    this.minSize = 0.5
    this.maxSizeAvailable = boundSize || 2
    this.maxSize = rand(this.minSize, this.maxSizeAvailable)
    this.sizeDirection = 1
    this.delay = delay
    this.delayHide = delayHide
    this.counter = 0
    this.counterHide = 0
    this.counterStep = step
    this.isHidden = false
    this.isFlicking = false
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const centerOffset = this.maxSizeAvailable * 0.5 - this.size * 0.5
    ctx.fillStyle = this.color
    ctx.fillRect(
      this.x + centerOffset,
      this.y + centerOffset,
      this.size,
      this.size
    )
  }

  show(): void {
    this.isHidden = false
    this.counterHide = 0

    if (this.counter <= this.delay) {
      this.counter += this.counterStep
      return
    }

    if (this.size >= this.maxSize) {
      this.isFlicking = true
    }

    if (this.isFlicking) {
      this.flicking()
    } else {
      this.size += this.sizeStep
    }
  }

  hide(): void {
    this.counter = 0

    if (this.counterHide <= this.delayHide) {
      this.counterHide += this.counterStep
      if (this.isFlicking) {
        this.flicking()
      }
      return
    }
    
    this.isFlicking = false

    if (this.size <= 0) {
      this.size = 0
      this.isHidden = true
      return
    } else {
      this.size -= 0.05
    }
  }

  flicking(): void {
    if (this.size >= this.maxSize) {
      this.sizeDirection = -1
    } else if (this.size <= this.minSize) {
      this.sizeDirection = 1
    }
    
    this.size += this.sizeDirection * this.speed
  }
}

function Loading({ width = '40vw', height = '40vh', className = '' }: LoadingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const pixelsRef = useRef<PixelClass[]>([])
  const tickerRef = useRef(0)
  const animationDirectionRef = useRef(1)
  const lastTimeRef = useRef(0)

  const getDelay = (x: number, y: number, width: number, height: number, direction?: boolean): number => {
    let dx = x - width * 0.5
    let dy = y - height
    
    if (direction) {
      dy = y
    }
    
    return Math.sqrt(dx ** 2 + dy ** 2)
  }

  const initPixels = (width: number, height: number): void => {
    // Cores baseadas no tema atual
    const theme = document.documentElement.style.getPropertyValue('--color-primary') || '#1f4e79'
    
    // Definir tons baseados no tema
    let baseHues: number[]
    if (theme.includes('3b82f6') || theme.includes('2563eb')) {
      // Azul
      baseHues = [210, 220, 230, 240, 250, 260]
    } else if (theme.includes('f97316') || theme.includes('ea580c')) {
      // Laranja
      baseHues = [20, 30, 40, 50, 60, 70]
    } else if (theme.includes('10b981') || theme.includes('059669')) {
      // Verde
      baseHues = [140, 150, 160, 170, 180, 190]
    } else if (theme.includes('ef4444') || theme.includes('dc2626')) {
      // Vermelho
      baseHues = [0, 10, 20, 30, 40, 50]
    } else if (theme.includes('ec4899') || theme.includes('db2777')) {
      // Rosa
      baseHues = [320, 330, 340, 350, 360, 370]
    } else {
      // Roxo (padrão)
      baseHues = [270, 280, 290, 300, 310, 320]
    }
    
    const colors = baseHues.map(hue => 
      `hsl(${hue}, ${rand(70, 100)}%, ${rand(50, 80)}%)`
    )
    
    const gap = 6
    const step = (width + height) * 0.005
    const speed = rand(0.008, 0.25)
    const maxSize = Math.floor(gap * 0.5)
    
    pixelsRef.current = []
    
    for (let x = 0; x < width; x += gap) {
      for (let y = 0; y < height; y += gap) {
        if (x + maxSize > width || y + maxSize > height) {
          continue
        }

        const color = colors[Math.floor(Math.random() * colors.length)]
        const delay = getDelay(x, y, width, height, false)
        const delayHide = getDelay(x, y, width, height, true)

        pixelsRef.current.push(new PixelClass(x, y, color, speed, delay, delayHide, step, maxSize))
      }
    }
  }

  const animate = (): void => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    animationRef.current = requestAnimationFrame(animate)
    
    const now = performance.now()
    const interval = 1000 / 60
    const diff = now - lastTimeRef.current

    if (diff < interval) {
      return
    }

    lastTimeRef.current = now - (diff % interval)

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const maxTicker = 360
    if (tickerRef.current >= maxTicker) {
      animationDirectionRef.current = -1
    } else if (tickerRef.current <= 0) {
      animationDirectionRef.current = 1
    }
    
    let allHidden = true

    pixelsRef.current.forEach((pixel) => {
      if (animationDirectionRef.current > 0) {
        pixel.show()
      } else {
        pixel.hide()
        allHidden = allHidden && pixel.isHidden
      }

      pixel.draw(ctx)
    })
    
    tickerRef.current += animationDirectionRef.current
    
    if (animationDirectionRef.current < 0 && allHidden) {
      tickerRef.current = 0
    }
  }

  const resize = (): void => {
    const canvas = canvasRef.current
    const container = containerRef.current
    
    if (!canvas || !container) return

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    
    const rect = container.getBoundingClientRect()
    const canvasWidth = Math.floor(rect.width)
    const canvasHeight = Math.floor(rect.height)
    
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    
    initPixels(canvasWidth, canvasHeight)
    
    tickerRef.current = 0
    
    animate()
  }

  useEffect(() => {
    const resizeObserver = new ResizeObserver((_entries) => {
      resize()
    })
    const container = containerRef.current
    
    if (container) {
      resizeObserver.observe(container)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (container) {
        resizeObserver.unobserve(container)
      }
    }
  }, [])

  return (
    <div 
      ref={containerRef}
      className={`loading-container ${className}`}
      style={{ width, height }}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}

export default Loading 