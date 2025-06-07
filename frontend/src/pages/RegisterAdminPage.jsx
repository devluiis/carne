import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider.jsx';
import { useNavigate } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';

function RegisterAdminPage() {
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [senha, setSenha] = useState('');
    const [loading, setLoading] = useState(false);
    const { registerAdmin } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await registerAdmin({ email, nome, senha, perfil: 'admin' });
            setGlobalAlert({ message: 'Usuário administrador registrado com sucesso! Você pode fazer login agora.', type: 'success' });
            setEmail('');
            setNome('');
            setSenha('');
        } catch (err) {
            const errorMsg = `Erro ao registrar administrador: ${err.response?.data?.detail || err.message}`;
            setGlobalAlert({ message: errorMsg, type: 'error' });
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="form-container">
            <h2>Registrar Novo Administrador</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="adminEmail">Email:</label>
                    <input
                        type="email"
                        id="adminEmail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="adminNome">Nome:</label>
                    <input
                        type="text"
                        id="adminNome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="adminSenha">Senha (mínimo 6 caracteres):</label>
                    <input
                        type="password"
                        id="adminSenha"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        required
                        minLength="6"
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="adminPerfil">Perfil:</label>
                    <select
                        id="adminPerfil"
                        value="admin" // Perfil fixo como 'admin'
                        disabled
                        className="form-select"
                    >
                        <option value="admin">Administrador</option>
                    </select>
                </div>
                <button type="submit" className="btn btn-success" disabled={loading}>
                    {loading ? 'Registrando...' : 'Registrar Administrador'}
                </button>
                 <button type="button" onClick={() => navigate('/dashboard')} className="btn btn-secondary mt-2">
                    Cancelar
                </button>
            </form>
        </div>
    );
}

export default RegisterAdminPage;