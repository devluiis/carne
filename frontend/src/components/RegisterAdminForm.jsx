import React, { useState } from 'react';
import { useAuth } from './AuthProvider.jsx';
import { useNavigate } from 'react-router-dom';

function RegisterAdminForm() {
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [senha, setSenha] = useState('');
    const [perfil, setPerfil] = useState('admin'); // Padrão 'admin' para este formulário
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const { registerAdmin } = useAuth(); // Usar a nova função do AuthProvider
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            await registerAdmin({ email, nome, senha, perfil });
            setSuccess('Usuário administrador registrado com sucesso! Você pode fazer login agora.');
            setEmail('');
            setNome('');
            setSenha('');
            // Opcional: Redirecionar após o registro
            // navigate('/'); 
        } catch (err) {
            console.error('Erro no registro de admin:', err);
            setError(`Erro ao registrar: ${err.response?.data?.detail || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={formContainerStyle}>
            <h2>Registrar Novo Administrador</h2>
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
                {/* O perfil pode ser um campo oculto ou desabilitado, se for sempre 'admin' */}
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Perfil:</label>
                    <select
                        value={perfil}
                        onChange={(e) => setPerfil(e.target.value)}
                        required
                        style={inputStyle}
                        disabled={true} // Desabilita a alteração do perfil neste formulário
                    >
                        <option value="admin">Administrador</option>
                        <option value="atendente">Atendente</option>
                    </select>
                </div>
                <button type="submit" disabled={loading} style={submitButtonStyle}>
                    {loading ? 'Registrando...' : 'Registrar Administrador'}
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
const submitButtonStyle = { width: '100%', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }; // Botão verde para admin
const cancelButtonStyle = { width: '100%', padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' };

export default RegisterAdminForm;