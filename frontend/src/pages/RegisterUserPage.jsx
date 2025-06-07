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
        } catch (err) {
            setGlobalAlert({ message: `Erro ao registrar: ${err.response?.data?.detail || err.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container form-container" style={{maxWidth: '450px'}}> {/* Mantido maxWidth para este formulário específico */}
            <h2 className="text-center mb-4">Registrar Novo Usuário (Atendente)</h2> {/* mb-4 do Bootstrap */}
            <form onSubmit={handleSubmit}>
                <div className="mb-3">
                    <label htmlFor="nome" className="form-label">Nome:</label>
                    <input
                        type="text"
                        id="nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        className="form-control"
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="email" className="form-label">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="form-control"
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="senha" className="form-label">Senha (mínimo 6 caracteres):</label>
                    <input
                        type="password"
                        id="senha"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        required
                        minLength="6"
                        className="form-control"
                    />
                </div>
                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                    {loading ? 'Registrando...' : 'Registrar'}
                </button>
            </form>
            <p className="text-center mt-3 mb-0"> {/* mt-3 mb-0 do Bootstrap */}
                Já tem uma conta? <Link to="/">Faça o login</Link>
            </p>
        </div>
    );
}

export default RegisterUserPage;