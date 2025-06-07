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
            setGlobalAlert({ message: 'Usuário administrador registrado com sucesso!', type: 'success' });
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
        <div className="container form-container" style={{maxWidth: '450px'}}> {/* Mantido maxWidth para este formulário específico */}
            <h2 className="text-center mb-4">Registrar Novo Administrador</h2> {/* mb-4 do Bootstrap */}
            <form onSubmit={handleSubmit}>
                <div className="mb-3"> {/* mb-3 do Bootstrap */}
                    <label htmlFor="email" className="form-label">Email:</label> {/* form-label do Bootstrap */}
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="form-control" /* form-control do Bootstrap */
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
                <button type="submit" className="btn btn-success w-100" disabled={loading}> {/* w-100 do Bootstrap */}
                    {loading ? 'Registrando...' : 'Registrar Administrador'}
                </button>
                <button type="button" onClick={() => navigate('/dashboard')} className="btn btn-secondary w-100 mt-2"> {/* w-100 mt-2 do Bootstrap */}
                    Cancelar
                </button>
            </form>
        </div>
    );
}

export default RegisterAdminPage;