import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import AuthLayout from '../components/AuthLayout'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
    const navigate = useNavigate()
    const { user, loading: authLoading } = useAuth()

    if (!authLoading && user) {
        return <Navigate to="/" replace />
    }

    return (
        <AuthLayout
            title="Create an account"
            subtitle="Sign up to save your preferences and CV data"
            footer={
                <>
                    Already have an account?{' '}
                    <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700 cursor-default">
                        Sign in
                    </Link>
                </>
            }
        >
            <AuthForm mode="signup" onSuccess={() => navigate('/', { replace: true })} />
        </AuthLayout>
    )
}
