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
        <div className="container d-flex justify-content-center align-items-center vh-100"> {/* Centraliza na tela */}
            <div className="card p-4 shadow-sm" style={{maxWidth: '450px'}}> {/* Card do Bootstrap */}
                <h2 className="text-center mb-4">Login</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-3"> {/* mb-3 do Bootstrap */}
                        <label htmlFor="email" className="form-label">Email:</label> {/* form-label do Bootstrap */}
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="form-control" /* form-control do Bootstrap */
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="password" className="form-label">Senha:</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="form-control"
                        />
                    </div>
                    <button type="submit" className="btn btn-primary w-100" disabled={loading}> {/* w-100 para largura total */}
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
                <p className="text-center mt-3 mb-0"> {/* mt-3 mb-0 do Bootstrap */}
                    Não tem uma conta?{' '}
                    <Link to="/register-user">Registre-se</Link>
                </p>
            </div>
        </div>
    );
}

export default LoginForm;