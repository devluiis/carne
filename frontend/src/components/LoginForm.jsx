import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useNavigate, Link } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';

function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
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
            setGlobalAlert({ message: 'Credenciais inválidas. Verifique seu email e senha.', type: 'error' });
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="form-container login-form-container"> {/* Adicionei login-form-container para ajuste de max-width */}
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="email">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Senha:</label>
                    <input
                        type="password"
                        id="password"
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
                <Link to="/register-user" className="link-text">Registre-se</Link> {/* Usei uma classe para o link */}
            </p>
        </div>
    );
}

export default LoginForm;