import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useNavigate, Link } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';

// Importações do Material-UI
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress'; // Para o spinner de loading

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const { setGlobalAlert } = useGlobalAlert();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
            setGlobalAlert({ message: 'Login realizado com sucesso!', type: 'success' });
            navigate('/dashboard');
        } catch (err) {
            const errorMessage = 'Credenciais inválidas. Verifique seu email e senha.';
            setGlobalAlert({ message: errorMessage, type: 'error' });
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs" className="flex items-center justify-center min-h-screen">
            <Box
                sx={{
                    marginTop: 4, // mb-4
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: 4, // padding-4 (Tailwind equivalent)
                    borderRadius: 2, // rounded-lg
                    boxShadow: 3, // shadow-md
                    bgcolor: 'background.paper', // bg-white
                }}
                className="w-full max-w-md mx-auto" // Tailwind classes for responsive width and centering
            >
                <Typography component="h1" variant="h5" className="mb-6 font-bold text-gray-800">
                    Login
                </Typography>
                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }} className="w-full">
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="email"
                        label="Email"
                        name="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mb-4" // Tailwind for margin-bottom
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Senha"
                        type="password"
                        id="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mb-6" // Tailwind for margin-bottom
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }} // mt-3, mb-2 (Tailwind equivalent)
                        disabled={loading}
                        className="py-3 text-lg font-semibold" // Tailwind for padding-y, text-size, font-weight
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Entrar'}
                    </Button>
                    <Box className="text-center mt-4">
                        <Typography variant="body2">
                            Não tem uma conta?{' '}
                            <Link to="/register-user" className="text-blue-600 hover:underline font-medium">
                                Registre-se
                            </Link>
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Container>
    );
}

export default LoginPage;