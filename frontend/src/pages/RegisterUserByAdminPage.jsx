import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider.jsx';
import { useNavigate } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';

function RegisterUserByAdminForm() {
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [senha, setSenha] = useState('');
    const [loading, setLoading] = useState(false);
    const { registerAtendenteByAdmin } = useAuth();
    const navigate = useNavigate();
    const { setGlobalAlert } = useGlobalAlert();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await registerAtendenteByAdmin({ email, nome, senha, perfil: "atendente" });
            setGlobalAlert({ message: 'Novo atendente registrado com sucesso!', type: 'success' });
            setEmail('');
            setNome('');
            setSenha('');
        } catch (err) {
            console.error('Erro no registro de atendente:', err);
            setGlobalAlert({ message: `Erro ao registrar atendente: ${err.response?.data?.detail || err.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container form-container" style={{maxWidth: '450px'}}> {/* Mantido maxWidth para este formulário específico */}
            <h2 className="text-center mb-4">Registrar Novo Atendente</h2> {/* mb-4 do Bootstrap */}
            <form onSubmit={handleSubmit}>
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
                    <label htmlFor="senha" className="form-label">Senha:</label>
                    <input
                        type="password"
                        id="senha"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        required
                        className="form-control"
                    />
                </div>
                <button type="submit" className="btn btn-success w-100" disabled={loading}>
                    {loading ? 'Registrando...' : 'Registrar Atendente'}
                </button>
                <button type="button" onClick={() => navigate('/clients')} className="btn btn-secondary w-100 mt-2">
                    Cancelar
                </button>
            </form>
        </div>
    );
}

export default RegisterUserByAdminForm;