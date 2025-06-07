import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider.jsx';
import { auth as apiAuth } from '../api.js';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

function ProfilePage() {
    const { user, loading: authLoading, updateUser } = useAuth();
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
            if (updateUser) {
                updateUser(updatedUserData.data);
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
                    <label htmlFor="profileName">Nome:</label>
                    <input
                        type="text"
                        id="profileName"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="profileEmail">Email:</label>
                    <input
                        type="email"
                        id="profileEmail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="profilePerfil">Perfil:</label>
                    <input
                        type="text"
                        id="profilePerfil"
                        value={user.perfil}
                        disabled
                        className="form-input"
                    />
                </div>
                 <div className="form-group">
                    <label htmlFor="profileDataCadastro">Data de Cadastro:</label>
                    <input
                        type="text"
                        id="profileDataCadastro"
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