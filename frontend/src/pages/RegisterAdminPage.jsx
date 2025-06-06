import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider.jsx';
import { useNavigate } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';

function RegisterAdminPage() {
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [senha, setSenha] = useState('');
    const [loading, setLoading] = useState(false);
    const { registerAdmin } = useAuth(); // <-- registerAdmin já está aqui
    const { setGlobalAlert } = useGlobalAlert();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // CORREÇÃO AQUI: Chame registerAdmin diretamente
            await registerAdmin({ email, nome, senha, perfil: 'admin' }); 
            setGlobalAlert({ message: 'Usuário administrador registrado com sucesso!', type: 'success' });
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
    
    // Remova ou comente esta linha, pois 'auth' não é mais necessário diretamente aqui
    // import { auth } from '../api'; 


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
