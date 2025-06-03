import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider.jsx'; // Corrigido o caminho
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
            await register({ email, nome, senha, perfil: "atendente" }); // Perfil é 'atendente' por padrão
            setGlobalAlert({ message: 'Usuário registrado com sucesso! Você pode fazer login agora.', type: 'success' });
            // Limpa os campos após o sucesso
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
        <div className="form-container" style={{maxWidth: '450px'}}>
            <h2>Registrar Novo Usuário (Atendente)</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Nome:</label>
                    <input
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
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
                    <label>Senha (mínimo 6 caracteres):</label>
                    <input
                        type="password"
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
                Já tem uma conta? <Link to="/">Faça o login</Link>
            </p>
        </div>
    );
}

export default RegisterUserPage;