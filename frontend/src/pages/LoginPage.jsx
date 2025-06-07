import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useNavigate, Link } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';

function LoginPage() { // Renomeado de LoginForm para LoginPage para consistência
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false); // Adicionado loading ao estado
    const { login } = useAuth();
    const navigate = useNavigate();
    const { setGlobalAlert } = useGlobalAlert();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
            setGlobalAlert({ message: 'Login realizado com sucesso!', type: 'success' });
            navigate('/dashboard');
        } catch (err) {
            const errorMessage = 'Credenciais inválidas. Verifique seu email e senha.';
            setGlobalAlert({ message: errorMessage, type: 'error' });
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="form-container login-form-container">
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="loginEmail">Email:</label>
                    <input
                        type="email"
                        id="loginEmail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="loginPassword">Senha:</label>
                    <input
                        type="password"
                        id="loginPassword"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Entrando...' : 'Entrar'}
                </button>
            </form>
            <p className="text-center mt-2">
                Não tem uma conta?{' '}
                <Link to="/register-user" className="link-text">
                    Registre-se
                </Link>
            </p>
        </div>
    );
}

export default LoginPage;