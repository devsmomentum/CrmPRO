import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CircleNotch } from '@phosphor-icons/react'

export function LoadingScreen() {
    const [tipIndex, setTipIndex] = useState(0)

    const tips = [
        "Organizando tu espacio de trabajo...",
        "Sincronizando contactos y empresas...",
        "Preparando tus pipelines...",
        "Cargando analíticas en tiempo real...",
        "Conectando con tu equipo..."
    ]

    useEffect(() => {
        const interval = setInterval(() => {
            setTipIndex(prev => (prev + 1) % tips.length)
        }, 2000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50">
            <div className="relative flex flex-col items-center">
                {/* Logo o Icono Central con efecto de pulso */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="mb-8 relative"
                >
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                    <div className="h-20 w-20 bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl relative z-10">
                        <span className="text-4xl font-bold text-white">C</span>
                    </div>
                </motion.div>

                {/* Spinner elegante */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="mb-6"
                >
                    <CircleNotch size={32} className="text-primary" />
                </motion.div>

                {/* Texto de carga dinámico */}
                <div className="h-8 flex items-center justify-center overflow-hidden relative w-64">
                    <motion.p
                        key={tipIndex}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        className="text-muted-foreground text-sm font-medium absolute text-center w-full"
                    >
                        {tips[tipIndex]}
                    </motion.p>
                </div>
            </div>

            {/* Barra de progreso decorativa en el fondo */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
                <motion.div
                    className="h-full bg-gradient-to-r from-primary via-purple-500 to-primary"
                    animate={{
                        x: ["-100%", "100%"],
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: 2,
                        ease: "easeInOut"
                    }}
                />
            </div>
        </div>
    )
}
