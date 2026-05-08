import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, createRoutesFromElements, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Portal from './pages/portal/Portal'
import './index.css'

const router = createBrowserRouter(
    createRoutesFromElements(
        <>
            <Route path='/' element={<Layout/>}>
                <Route path='/' element={<Home/>} />
                <Route path='/portal/:portal' element={<Portal/>} />
            </Route>
        </>
    )
)

const rootElement = document.getElementById('root')

if (!rootElement) {
    throw new Error("Root element with id 'root' not found")
}

ReactDOM.createRoot(rootElement).render(
    <RouterProvider router={router} />
)
