import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider.jsx';
import { useNavigate } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';

function RegisterAdminPage() {
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [senha, setSenha] = useState('');
    const [perfil, setPerfil] = useState('admin');
    const [loading, setLoading] = useState(false);
    const { registerAdmin } = useAuth();
    const navigate = useNavigate();
    const { setGlobalAlert } = useGlobalAlert();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await registerAdmin({ email, nome, senha, perfil });
            setGlobalAlert({ message: 'Usuário administrador registrado com sucesso! Você pode fazer login agora.', type: 'success' });
            setEmail('');
            setNome('');
            setSenha('');
            // Opcional: Redirecionar após o registro
            // navigate('/'); 
        } catch (err) {
            console.error('Erro no registro de admin:', err);
            setGlobalAlert({ message: `Erro ao registrar: ${err.response?.data?.detail || err.message}`, type: 'error' });
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
                    <label htmlFor="adminSenha">Senha:</label>
                    <input
                        type="password"
                        id="adminSenha"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="perfilAdmin">Perfil:</label>
                    <select
                        id="perfilAdmin"
                        value={perfil}
                        onChange={(e) => setPerfil(e.target.value)}
                        required
                        className="form-select"
                        disabled={true}
                    >
                        <option value="admin">Administrador</option>
                    </select>
                </div>
                <button type="submit" disabled={loading} className="btn btn-success">
                    {loading ? 'Registrando...' : 'Registrar Administrador'}
                </button>
                <button type="button" onClick={() => navigate('/')} className="btn btn-secondary mt-2">
                    Voltar para Login
                </button>
            </form>
        </div>
    );
}

export default RegisterAdminPage;