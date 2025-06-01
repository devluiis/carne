import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider.jsx';
import { auth } from '../api';
import { useGlobalAlert } from '../App.jsx'; // Importar useGlobalAlert

function ProfilePage() {
    const { user, loading: authLoading, logout } = useAuth();
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [submitLoading, setSubmitLoading] = useState(false);
    // const [message, setMessage] = useState(''); // Removido, agora usa alerta global
    // const [error, setError] = useState('');     // Removido, agora usa alerta global
    const { setGlobalAlert } = useGlobalAlert(); // Usar o contexto do alerta global


    useEffect(() => {
        if (user) {
            setNome(user.nome);
            setEmail(user.email);
        }
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        // setError('');     // Removido
        // setMessage(''); // Removido
        setSubmitLoading(true);

        try {
            const response = await auth.updateProfile({ nome, email });
            setGlobalAlert({ message: 'Perfil atualizado com sucesso!', type: 'success' }); // Feedback de sucesso global
            // Para atualizar o nome no Header imediatamente sem recarregar a página,
            // você precisaria de uma função 'updateUser' no AuthProvider
            // que atualizasse o estado 'user'. Por simplicidade, por enquanto,
            // o usuário verá a mudança após recarregar a página ou fazer um novo login.
        } catch (err) {
            console.error('Erro ao atualizar perfil:', err);
            setGlobalAlert({ message: `Falha ao atualizar perfil: ${err.response?.data?.detail || err.message}`, type: 'error' }); // Feedback de erro global
        } finally {
            setSubmitLoading(false);
        }
    };

    if (authLoading) return <p style={loadingStyle}>Carregando dados do perfil...</p>;
    if (!user) return <p style={errorStyle}>Usuário não logado.</p>;

    return (
        <div style={containerStyle}>
            <h2 style={headerStyle}>Meu Perfil</h2>
            {/* {message && <p style={successMessageStyle}>{message}</p>} */}
            {/* {error && <p style={errorMessageStyle}>{error}</p>} */}

            <form onSubmit={handleSubmit}>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Nome:</label>
                    <input
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        style={inputStyle}
                    />
                </div>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={inputStyle}
                    />
                </div>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Perfil:</label>
                    <input
                        type="text"
                        value={user.perfil}
                        disabled // Perfil geralmente não editável diretamente
                        style={inputStyle}
                    />
                </div>
                <button type="submit" disabled={submitLoading} style={submitButtonStyle}>
                    {submitLoading ? 'Atualizando...' : 'Atualizar Perfil'}
                </button>
            </form>
        </div>
    );
}

// Estilos
const containerStyle = { maxWidth: '600px', margin: '20px auto', padding: '20px', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
const headerStyle = { textAlign: 'center', marginBottom: '20px' };
const formGroupStyle = { marginBottom: '15px' };
const labelStyle = { display: 'block', marginBottom: '5px', fontWeight: 'bold' };
const inputStyle = { width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ddd' };
const submitButtonStyle = { width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const loadingStyle = { textAlign: 'center', fontSize: '1.2em', color: '#555' };
const errorMessageStyle = { color: 'red', textAlign: 'center' };
const successMessageStyle = { color: 'green', textAlign: 'center' };

export default ProfilePage;