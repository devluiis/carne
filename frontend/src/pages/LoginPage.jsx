import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx'; // Importar useGlobalAlert

function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(''); // Manter erro local para o formulário
    const { login } = useAuth();
    const navigate = useNavigate();
    const { setGlobalAlert } = useGlobalAlert(); // Usar o contexto do alerta global


    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await login(email, password);
            setGlobalAlert({ message: 'Login realizado com sucesso!', type: 'success' }); // Feedback de sucesso global
            navigate('/clients'); // Redireciona para a página de clientes após login
        } catch (err) {
            const errorMessage = 'Credenciais inválidas. Verifique seu email e senha.';
            setError(errorMessage); // Erro no formulário
            setGlobalAlert({ message: errorMessage, type: 'error' }); // Alerta global
            console.error(err);
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h2>Login</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Senha:</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Entrar</button>
            </form>
            <p style={{ marginTop: '15px', textAlign: 'center' }}>
                Não tem uma conta?{' '}
                <button
                    onClick={() => navigate('/register-user')}
                    style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer' }}
                >
                    Registre-se
                </button>
            </p>
        </div>
    );
}

export default LoginForm;