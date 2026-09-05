import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import AuthLayout from '../components/AuthLayout'
import { useAuth } from '../context/AuthContext'

type LoginLocationState = {
    from?: string
}

export default function Login() {
    const navigate = useNavigate()
    const location = useLocation()
    const redirectState = (location.state as LoginLocationState | null) ?? {}
    const redirectTo = redirectState.from ?? '/'
    const { user, loading: authLoading } = useAuth()

    if (!authLoading && user) {
        return <Navigate to={redirectTo} replace />
    }

    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Sign in to your account to continue"
            footer={
                <>
                    Don&apos;t have an account?{' '}
                    <Link to="/signup" className="font-medium text-emerald-600 hover:text-emerald-700 cursor-default">
                        Sign up
                    </Link>
                </>
            }
        >
            <AuthForm
                mode="login"
                onSuccess={() => navigate(redirectTo, { replace: true })}
            />
        </AuthLayout>
    )
}
