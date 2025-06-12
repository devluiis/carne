import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider.jsx';
import { useNavigate } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';

// Importações do Material-UI
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress';

function RegisterUserByAdminPage() {
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [senha, setSenha] = useState('');
    const [loading, setLoading] = useState(false);
    const { registerAtendenteByAdmin } = useAuth();
    const navigate = useNavigate();
    const { setGlobalAlert } = useGlobalAlert();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await registerAtendenteByAdmin({ email, nome, senha, perfil: "atendente" });
            setGlobalAlert({ message: 'Novo atendente registrado com sucesso!', type: 'success' });
            setEmail('');
            setNome('');
            setSenha('');
        } catch (err) {
            console.error('Erro no registro de atendente:', err);
            setGlobalAlert({ message: `Erro ao registrar atendente: ${err.response?.data?.detail || err.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs" className="flex items-center justify-center min-h-screen py-8">
            <Box
                sx={{
                    p: 4, // padding-4
                    borderRadius: 2, // rounded-lg
                    boxShadow: 3, // shadow-md
                    bgcolor: 'background.paper', // bg-white
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
                className="w-full max-w-md mx-auto" // Tailwind classes
            >
                <Typography component="h1" variant="h5" className="mb-6 font-bold text-gray-800">
                    Registrar Novo Atendente
                </Typography>
                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }} className="w-full">
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="atendenteEmail"
                        label="Email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mb-4"
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="atendenteNome"
                        label="Nome"
                        name="nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="mb-4"
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="atendenteSenha"
                        label="Senha"
                        name="senha"
                        type="password"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        className="mb-4"
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                        disabled={loading}
                        className="py-3 text-lg font-semibold"
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Registrar Atendente'}
                    </Button>
                    <Button
                        type="button"
                        fullWidth
                        variant="outlined"
                        onClick={() => navigate('/clients')}
                        className="py-3 text-lg font-semibold"
                    >
                        Cancelar
                    </Button>
                </Box>
            </Box>
        </Container>
    );
}

export default RegisterUserByAdminPage;