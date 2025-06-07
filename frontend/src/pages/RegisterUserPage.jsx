import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider.jsx';
import { useNavigate, Link } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';

function RegisterUserPage() {
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [senha, setSenha] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();
    const { setGlobalAlert } = useGlobalAlert();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await register({ email, nome, senha, perfil: "atendente" });
            setGlobalAlert({ message: 'Usuário registrado com sucesso! Você pode fazer login agora.', type: 'success' });
            setNome('');
            setEmail('');
            setSenha('');
            // Opcional: redirecionar para o login
            // navigate('/');
        } catch (err) {
            setGlobalAlert({ message: `Erro ao registrar: ${err.response?.data?.detail || err.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="form-container login-form-container"> {/* Mantive a classe para max-width */}
            <h2>Registrar Novo Usuário (Atendente)</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="userName">Nome:</label>
                    <input
                        type="text"
                        id="userName"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="userEmail">Email:</label>
                    <input
                        type="email"
                        id="userEmail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="userPassword">Senha (mínimo 6 caracteres):</label>
                    <input
                        type="password"
                        id="userPassword"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        required
                        minLength="6"
                        className="form-input"
                    />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Registrando...' : 'Registrar'}
                </button>
            </form>
            <p className="text-center mt-2">
                Já tem uma conta? <Link to="/" className="link-text">Faça o login</Link>
            </p>
        </div>
    );
}

export default RegisterUserPage;