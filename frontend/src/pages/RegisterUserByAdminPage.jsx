import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider.jsx';
import { useNavigate } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';

function RegisterUserByAdminPage() {
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
        <div className="form-container">
            <h2>Registrar Novo Atendente</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="atendenteEmail">Email:</label>
                    <input
                        type="email"
                        id="atendenteEmail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="atendenteNome">Nome:</label>
                    <input
                        type="text"
                        id="atendenteNome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="atendenteSenha">Senha:</label>
                    <input
                        type="password"
                        id="atendenteSenha"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <button type="submit" disabled={loading} className="btn btn-success">
                    {loading ? 'Registrando...' : 'Registrar Atendente'}
                </button>
                <button type="button" onClick={() => navigate('/clients')} className="btn btn-secondary mt-2">
                    Cancelar
                </button>
            </form>
        </div>
    );
}

export default RegisterUserByAdminPage;