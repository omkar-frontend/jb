import axios from 'axios'
import { supabase } from './supabase'

const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined

export const api = axios.create({
    baseURL: backendUrl,
})

api.interceptors.request.use(async (config) => {
    const {
        data: { session },
    } = await supabase.auth.getSession()

    const token = session?.access_token
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }

    return config
})

export function isApiConfigured() {
    return Boolean(backendUrl)
}
