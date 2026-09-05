import ReactDOM from 'react-dom/client'
import AppRouter from './AppRouter'
import { AuthProvider } from './context/AuthContext'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
    throw new Error("Root element with id 'root' not found")
}

ReactDOM.createRoot(rootElement).render(
    <AuthProvider>
        <AppRouter />
    </AuthProvider>
)
