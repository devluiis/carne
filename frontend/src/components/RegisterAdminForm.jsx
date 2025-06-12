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
import CircularProgress from '@mui/material/CircularProgress'; // Para o spinner de loading
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';

function RegisterAdminPage() {
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [senha, setSenha] = useState('');
    // O perfil é fixo como 'admin' e desabilitado na UI, então não é um estado mutável aqui
    const [loading, setLoading] = useState(false);
    const { registerAdmin } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await registerAdmin({ email, nome, senha, perfil: 'admin' }); // Perfil fixo
            setGlobalAlert({ message: 'Usuário administrador registrado com sucesso! Você pode fazer login agora.', type: 'success' });
            setEmail('');
            setNome('');
            setSenha('');
        } catch (err) {
            console.error('Erro no registro de admin:', err);
            const errorMsg = `Erro ao registrar administrador: ${err.response?.data?.detail || err.message}`;
            setGlobalAlert({ message: errorMsg, type: 'error' });
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
                    Registrar Novo Administrador
                </Typography>
                
                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }} className="w-full">
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="adminEmail"
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
                        id="adminNome"
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
                        id="adminSenha"
                        label="Senha (mínimo 6 caracteres)"
                        name="senha"
                        type="password"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        inputProps={{ minLength: 6 }}
                        className="mb-4"
                    />
                    
                    <FormControl fullWidth margin="normal" className="mb-6">
                        <InputLabel id="perfilAdmin-label">Perfil</InputLabel>
                        <Select
                            labelId="perfilAdmin-label"
                            id="adminPerfil"
                            value="admin" // Perfil fixo como 'admin'
                            label="Perfil"
                            disabled // Desabilita a seleção para o usuário
                        >
                            <MenuItem value="admin">Administrador</MenuItem>
                        </Select>
                    </FormControl>

                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                        disabled={loading}
                        className="py-3 text-lg font-semibold"
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Registrar Administrador'}
                    </Button>
                    <Button
                        type="button"
                        fullWidth
                        variant="outlined"
                        onClick={() => navigate('/dashboard')}
                        className="py-3 text-lg font-semibold"
                    >
                        Cancelar
                    </Button>
                </Box>
            </Box>
        </Container>
    );
}

export default RegisterAdminPage;