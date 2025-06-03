import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider.jsx';
import { auth as apiAuth } from '../api.js'; // Renomeado para evitar conflito com useAuth
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

function ProfilePage() {
    const { user, loading: authLoading, updateUser } = useAuth(); // Usar updateUser do AuthProvider
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [submitLoading, setSubmitLoading] = useState(false);
    const { setGlobalAlert } = useGlobalAlert();

    useEffect(() => {
        if (user) {
            setNome(user.nome);
            setEmail(user.email);
        }
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        try {
            const updatedUserData = await apiAuth.updateProfile({ nome, email });
            setGlobalAlert({ message: 'Perfil atualizado com sucesso!', type: 'success' });
            if (updateUser) { // Verifica se updateUser existe
                updateUser(updatedUserData.data); // Atualiza o usuário no contexto global
            }
        } catch (err) {
            const errorMessage = `Falha ao atualizar perfil: ${err.response?.data?.detail || err.message}`;
            setGlobalAlert({ message: errorMessage, type: 'error' });
        } finally {
            setSubmitLoading(false);
        }
    };

    if (authLoading || !user) {
        return <LoadingSpinner message="Carregando perfil..." />;
    }

    return (
        <div className="form-container">
            <h2>Meu Perfil</h2>
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
                    <label>Perfil:</label>
                    <input
                        type="text"
                        value={user.perfil}
                        disabled
                        className="form-input"
                    />
                </div>
                 <div className="form-group">
                    <label>Data de Cadastro:</label>
                    <input
                        type="text"
                        value={new Date(user.data_cadastro).toLocaleDateString()}
                        disabled
                        className="form-input"
                    />
                </div>
                <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                    {submitLoading ? 'Atualizando...' : 'Atualizar Perfil'}
                </button>
            </form>
        </div>
    );
}

export default ProfilePage;