import { Suspense, lazy } from 'react'
import {
    createBrowserRouter,
    createRoutesFromElements,
    Route,
    RouterProvider,
} from 'react-router-dom'
import InlineLoading from './components/InlineLoading'
import Layout from './components/Layout'
import Home from './pages/Home'
import NotFound from './pages/NotFound'

// Home is the landing page and stays in the initial bundle. The rest are split
// out — Details in particular drags in react-select, which no visitor needs
// before they open it.
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const Profile = lazy(() => import('./pages/Profile'))
const Details = lazy(() => import('./pages/Details'))
const Portal = lazy(() => import('./pages/portal/Portal'))

function RouteFallback() {
    return (
        <div className="flex min-h-[calc(100dvh-8rem)] items-start justify-center p-10">
            <InlineLoading label="Loading…" />
        </div>
    )
}

const lazyRoute = (element: React.ReactNode) => (
    <Suspense fallback={<RouteFallback />}>{element}</Suspense>
)

const router = createBrowserRouter(
    createRoutesFromElements(
        <>
            <Route path="/" element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={lazyRoute(<Login />)} />
                <Route path="/signup" element={lazyRoute(<Signup />)} />
                <Route path="/profile" element={lazyRoute(<Profile />)} />
                <Route path="/details" element={lazyRoute(<Details />)} />
                <Route path="/portal/:portal" element={lazyRoute(<Portal />)} />
                <Route path="*" element={<NotFound />} />
            </Route>
        </>
    )
)

export default function AppRouter() {
    return <RouterProvider router={router} />
}
