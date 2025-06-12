import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider.jsx';
import { useNavigate, Link } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';

// Importações do Material-UI
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress';

function RegisterUserPage() {
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [senha, setSenha] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();
    const { setGlobalAlert } = useGlobalAlert();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await register({ email, nome, senha, perfil: "atendente" });
            setGlobalAlert({ message: 'Usuário registrado com sucesso! Você pode fazer login agora.', type: 'success' });
            setNome('');
            setEmail('');
            setSenha('');
            // Opcional: redirecionar para o login
            // navigate('/');
        } catch (err) {
            setGlobalAlert({ message: `Erro ao registrar: ${err.response?.data?.detail || err.message}`, type: 'error' });
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
                    Registrar Novo Usuário (Atendente)
                </Typography>
                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }} className="w-full">
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="userName"
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
                        id="userEmail"
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
                        id="userPassword"
                        label="Senha (mínimo 6 caracteres)"
                        name="senha"
                        type="password"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        inputProps={{ minLength: 6 }}
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
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Registrar'}
                    </Button>
                    <Box className="text-center mt-4">
                        <Typography variant="body2">
                            Já tem uma conta?{' '}
                            <Link to="/" className="text-blue-600 hover:underline font-medium">
                                Faça o login
                            </Link>
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Container>
    );
}

export default RegisterUserPage;