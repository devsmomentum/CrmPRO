/**
 * useDateFormat Hook
 * 
 * Utilidades para formateo seguro de fechas. Unifica las funciones duplicadas
 * `safeFormat` (ChatsView) y `formatSafeDate` (LeadDetailSheet).
 * 
 * **¿Qué hace?**
 * - Formatea fechas de forma segura evitando errores con fechas inválidas
 * - Soporta Date objects, strings ISO, timestamps, null y undefined
 * - Permite configurar el valor de fallback para fechas inválidas
 * 
 * **¿Dónde afecta?**
 * - ChatsView.tsx: Timestamps de mensajes, última actividad
 * - LeadDetailSheet.tsx: Fechas de leads, notas, reuniones, presupuestos
 * - Futuros componentes: MessageBubble, ActivityLog, etc.
 * 
 * **Testing requerido:**
 * 1. Verificar que las fechas se muestran correctamente en Chats
 * 2. Verificar fechas en LeadDetailSheet (notas, reuniones, etc.)
 */

import { format, type Locale } from 'date-fns'
import { es } from 'date-fns/locale'
import { useCallback, useMemo } from 'react'

// Tipos de entrada válidos para fechas
type DateInput = Date | string | number | null | undefined

// Opciones de formateo
interface FormatOptions {
    /** Valor a retornar si la fecha es inválida (default: '') */
    fallback?: string
    /** Locale para el formateo (default: es) */
    locale?: Locale
}

/**
 * Formatea una fecha de forma segura, retornando fallback si la fecha es inválida.
 * Esta es la función principal exportada, usable sin hook si solo necesitas formatear.
 * 
 * @param date - Fecha a formatear (Date, string, number, null, undefined)
 * @param formatStr - String de formato (ej: 'HH:mm', 'MMM d, yyyy')
 * @param options - Opciones adicionales (fallback, locale)
 * @returns String formateado o fallback si la fecha es inválida
 */
export function safeFormatDate(
    date: DateInput,
    formatStr: string,
    options: FormatOptions = {}
): string {
    const { fallback = '', locale = es } = options

    if (date === null || date === undefined) {
        return fallback
    }

    try {
        const dateObj = date instanceof Date ? date : new Date(date)

        if (isNaN(dateObj.getTime())) {
            return fallback
        }

        return format(dateObj, formatStr, { locale })
    } catch {
        return fallback
    }
}

/**
 * Verifica si una fecha es válida
 */
export function isValidDate(date: DateInput): boolean {
    if (date === null || date === undefined) {
        return false
    }

    try {
        const dateObj = date instanceof Date ? date : new Date(date)
        return !isNaN(dateObj.getTime())
    } catch {
        return false
    }
}

/**
 * Convierte cualquier entrada a Date object o null si es inválido
 */
export function toDate(date: DateInput): Date | null {
    if (date === null || date === undefined) {
        return null
    }

    try {
        const dateObj = date instanceof Date ? date : new Date(date)
        return isNaN(dateObj.getTime()) ? null : dateObj
    } catch {
        return null
    }
}

/**
 * Hook para formateo de fechas con funciones memoizadas
 * 
 * @example
 * ```tsx
 * const { formatDate, formatTime, formatRelative } = useDateFormat()
 * 
 * return <span>{formatDate(lead.createdAt)}</span>
 * ```
 */
export function useDateFormat(defaultOptions: FormatOptions = {}) {
    const { fallback = '', locale = es } = defaultOptions

    /**
     * Formatea una fecha con formato y opciones personalizadas
     */
    const formatDate = useCallback((
        date: DateInput,
        formatStr: string,
        options?: FormatOptions
    ) => {
        return safeFormatDate(date, formatStr, {
            fallback: options?.fallback ?? fallback,
            locale: options?.locale ?? locale
        })
    }, [fallback, locale])

    /**
     * Formatos comunes pre-definidos para uso rápido
     */
    const formatters = useMemo(() => ({
        /** Solo hora: "14:30" */
        time: (date: DateInput) => safeFormatDate(date, 'HH:mm', { fallback, locale }),

        /** Hora con AM/PM: "2:30 PM" */
        time12h: (date: DateInput) => safeFormatDate(date, 'h:mm a', { fallback, locale }),

        /** Fecha corta: "Jan 25, 2026" */
        dateShort: (date: DateInput) => safeFormatDate(date, 'MMM d, yyyy', { fallback, locale }),

        /** Fecha larga: "Saturday, 25 de January" */
        dateLong: (date: DateInput) => safeFormatDate(date, "EEEE, d 'de' MMMM", { fallback, locale }),

        /** Fecha y hora: "Jan 25, 2026 2:30 PM" */
        dateTime: (date: DateInput) => safeFormatDate(date, 'MMM d, yyyy h:mm a', { fallback, locale }),

        /** Fecha completa con hora: "25 Jan 2026, 14:30" */
        full: (date: DateInput) => safeFormatDate(date, 'dd MMM yyyy, HH:mm', { fallback, locale }),

        /** Solo para comparar fechas: "2026-01-25" */
        isoDate: (date: DateInput) => safeFormatDate(date, 'yyyy-MM-dd', { fallback, locale }),
    }), [fallback, locale])

    return {
        formatDate,
        ...formatters,
        isValidDate,
        toDate
    }
}

// Re-export para compatibilidad con código existente
export { es } from 'date-fns/locale'
