import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, createRoutesFromElements, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { AuthProvider } from './context/AuthContext'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Signup from './pages/Signup'
import Portal from './pages/portal/Portal'
import Details from './pages/Details'
import NotFound from './pages/NotFound'
import './index.css'

const router = createBrowserRouter(
    createRoutesFromElements(
        <>
            <Route path='/' element={<Layout/>}>
                <Route path='/' element={<Home/>} />
                <Route path='/login' element={<Login/>} />
                <Route path='/signup' element={<Signup/>} />
                <Route path='/profile' element={<Profile/>} />
                <Route path='/details' element={<Details/>} />
                <Route path='/portal/:portal' element={<Portal/>} />
                <Route path='*' element={<NotFound/>} />
            </Route>
        </>
    )
)

const rootElement = document.getElementById('root')

if (!rootElement) {
    throw new Error("Root element with id 'root' not found")
}

ReactDOM.createRoot(rootElement).render(
    <AuthProvider>
        <RouterProvider router={router} />
    </AuthProvider>
)
