import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider.jsx'; // Corrigido o caminho
import { useNavigate } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';

function RegisterAdminPage() {
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [senha, setSenha] = useState('');
    // O perfil é sempre 'admin' para este formulário específico
    const [loading, setLoading] = useState(false);
    const { registerAdmin } = useAuth(); // Assumindo que existe essa função no AuthProvider
    const { setGlobalAlert } = useGlobalAlert();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // A função auth.registerAdmin que existia no seu código antigo deve estar no api.js
            // e ser chamada pelo AuthProvider
            // Por agora, vamos assumir que AuthProvider tem `registerAdmin`
             await auth.registerAdmin({ email, nome, senha, perfil: 'admin' }); // Chamada direta ao API
            setGlobalAlert({ message: 'Usuário administrador registrado com sucesso!', type: 'success' });
            // Limpar campos ou redirecionar
            setEmail('');
            setNome('');
            setSenha('');
            // navigate('/dashboard'); // ou para outra página
        } catch (err) {
            const errorMsg = `Erro ao registrar administrador: ${err.response?.data?.detail || err.message}`;
            setGlobalAlert({ message: errorMsg, type: 'error' });
        } finally {
            setLoading(false);
        }
    };
    
    // Precisamos importar 'auth' da api.js se a função não estiver no AuthProvider
    // Para este exemplo, vou assumir que você tem auth.registerAdmin em '../api.js'
    // Se não, você precisará ajustar ou adicionar essa função no AuthProvider
    // import { auth } from '../api'; // Descomente se registerAdmin não estiver no AuthProvider


    return (
        <div className="form-container" style={{maxWidth: '450px'}}>
            <h2>Registrar Novo Administrador</h2>
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