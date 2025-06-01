import React, { useState } from 'react';
import { useAuth } from './AuthProvider.jsx'; // Importar AuthProvider
import { useNavigate } from 'react-router-dom';

function RegisterUserForm() {
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [senha, setSenha] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth(); // Usar a função 'register' do AuthProvider
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            // Chama a função de registro do AuthProvider, que se comunica com o backend /register
            await register({ email, nome, senha, perfil: "atendente" }); // Perfil fixo como "atendente" para este formulário
            setSuccess('Usuário registrado com sucesso! Você pode fazer login agora.');
            setEmail('');
            setNome('');
            setSenha('');
            // Opcional: Redirecionar para a página de login após o registro bem-sucedido
            // navigate('/'); 
        } catch (err) {
            console.error('Erro no registro de usuário:', err);
            setError(`Erro ao registrar: ${err.response?.data?.detail || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={formContainerStyle}>
            <h2>Registrar Novo Usuário (Atendente)</h2>
            {success && <p style={{ color: 'green' }}>{success}</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleSubmit}>
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
                    <label style={labelStyle}>Senha:</label>
                    <input
                        type="password"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        required
                        style={inputStyle}
                    />
                </div>
                <button type="submit" disabled={loading} style={submitButtonStyle}>
                    {loading ? 'Registrando...' : 'Registrar'}
                </button>
                <button type="button" onClick={() => navigate('/')} style={cancelButtonStyle}>
                    Voltar para Login
                </button>
            </form>
        </div>
    );
}

// Estilos (reutilizados ou adaptados dos outros formulários)
const formContainerStyle = { maxWidth: '450px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
const formGroupStyle = { marginBottom: '15px' };
const labelStyle = { display: 'block', marginBottom: '5px', fontWeight: 'bold' };
const inputStyle = { width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ddd' };
const submitButtonStyle = { width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const cancelButtonStyle = { width: '100%', padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' };

export default RegisterUserForm;