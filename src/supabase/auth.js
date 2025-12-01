import { supabase } from './client'

function mapAuthError(error) {
	if (!error) return null
	const msg = (error.message || '').toLowerCase()
	if (msg.includes('database error saving new user')) {
		return 'Error interno creando el usuario. Verifica si el email ya existe o contacta soporte.'
	}
	if (msg.includes('user already registered') || msg.includes('duplicate key value violates unique constraint')) {
		return 'El email ya está registrado. Intenta iniciar sesión.'
	}
	if (msg.includes('invalid email')) {
		return 'El formato de email no es válido.'
	}
	if (msg.includes('password')) {
		return 'La contraseña no cumple los requisitos.'
	}
	return error.message || 'Error de autenticación'
}

export const register = async (email, password) => {
	const { data, error } = await supabase.auth.signUp({ email, password })
	if (error) {
		const friendly = mapAuthError(error)
		const e = new Error(friendly)
		e.original = error
		e.code = error.code
		e.status = error.status
		throw e
	}
	return data.user
}

export const login = async (email, password) => {
	const { data, error } = await supabase.auth.signInWithPassword({ email, password })
	if (error) {
		const friendly = mapAuthError(error)
		const e = new Error(friendly)
		e.original = error
		e.code = error.code
		e.status = error.status
		throw e
	}
	return data.user
}

export const logout = () => supabase.auth.signOut()
