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
        <div className="form-container" style={{maxWidth: '450px'}}> {/* Mantido maxWidth para este formulário específico */}
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>Senha:</label>
                    <input
                        type="password"
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
                <Link to="/register-user">Registre-se</Link>
            </p>
        </div>
    );
}

export default LoginForm;