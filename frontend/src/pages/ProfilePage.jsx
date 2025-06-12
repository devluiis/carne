import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider.jsx';
import { auth as apiAuth } from '../api.js';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

// Importações do Material-UI
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress';

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
        <Container component="main" maxWidth="sm" className="flex items-center justify-center min-h-screen py-8">
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
                    Meu Perfil
                </Typography>
                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }} className="w-full">
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="profileName"
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
                        id="profileEmail"
                        label="Email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mb-4"
                    />
                    <TextField
                        margin="normal"
                        fullWidth
                        id="profilePerfil"
                        label="Perfil"
                        name="perfil"
                        value={user.perfil}
                        disabled
                        className="mb-4"
                    />
                    <TextField
                        margin="normal"
                        fullWidth
                        id="profileDataCadastro"
                        label="Data de Cadastro"
                        name="data_cadastro"
                        value={new Date(user.data_cadastro).toLocaleDateString()}
                        disabled
                        className="mb-6"
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                        disabled={submitLoading}
                        className="py-3 text-lg font-semibold"
                    >
                        {submitLoading ? <CircularProgress size={24} color="inherit" /> : 'Atualizar Perfil'}
                    </Button>
                </Box>
            </Box>
        </Container>
    );
}

export default ProfilePage;