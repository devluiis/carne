import React, { useState } from 'react';
import { useAuth } from '@components/AuthProvider.jsx'; // Usando alias
import { useNavigate } from 'react-router-dom';
import { useGlobalAlert } from '@/App.jsx'; // Caminho corrigido para usar o alias '@'

// Importações do Material-UI para um design moderno
import {
    Box,        // Para layout e espaçamento
    Button,     // Botões com estilo Material-UI
    TextField,  // Campos de input estilizados
    Typography, // Componente para títulos e textos
    Container,  // Container para centralizar o formulário
    Paper,      // Para um "card" de fundo no formulário
    FormControl, // Para envolver Select
    InputLabel,  // Rótulo para Select
    Select,      // Componente Select
    MenuItem,    // Itens do Select
    CircularProgress // Para o spinner de carregamento no botão
} from '@mui/material';
import { useTheme } from '@mui/material/styles'; // Para acessar o tema e suas cores

function RegisterAdminPage() {
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [senha, setSenha] = useState('');
    const [loading, setLoading] = useState(false);
    const { registerAdmin } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();
    const navigate = useNavigate();
    const theme = useTheme(); // Hook para acessar o tema

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await registerAdmin({ email, nome, senha, perfil: 'admin' });
            setGlobalAlert({ message: 'Usuário administrador registrado com sucesso! Você pode fazer login agora.', type: 'success' });
            setEmail('');
            setNome('');
            setSenha('');
            // Opcional: Navegar para a página de login após o registro
            // navigate('/login');
        } catch (err) {
            const errorMsg = `Erro ao registrar administrador: ${err.response?.data?.detail || err.message}`;
            setGlobalAlert({ message: errorMsg, type: 'error' });
        } finally {
            setLoading(false);
        }
    };
    
    return (
        // Container centraliza o conteúdo e Paper adiciona um "card" estilizado
        <Container component="main" maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
            <Paper elevation={6} sx={{ p: { xs: 2, sm: 3 }, borderRadius: theme.shape.borderRadius }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}
                >
                    <Typography component="h1" variant="h5" sx={{ mb: 3, fontWeight: 'bold', color: theme.palette.primary.main }}>
                        Registrar Novo Administrador
                    </Typography>
                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
                        {/* Campo de Email */}
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="adminEmail"
                            label="Email"
                            name="email"
                            autoComplete="email"
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            variant="outlined" // Borda visível
                            size="medium" // Tamanho padrão
                            sx={{ mb: 2 }} // Margem inferior
                        />
                        {/* Campo de Nome */}
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="adminNome"
                            label="Nome"
                            name="nome"
                            autoComplete="name"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            variant="outlined"
                            size="medium"
                            sx={{ mb: 2 }}
                        />
                        {/* Campo de Senha */}
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="senha"
                            label="Senha (mínimo 6 caracteres)"
                            type="password"
                            id="adminSenha"
                            autoComplete="new-password"
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                            minLength="6"
                            variant="outlined"
                            size="medium"
                            sx={{ mb: 2 }}
                        />
                        {/* Campo de Perfil (desabilitado) */}
                        <FormControl fullWidth margin="normal" sx={{ mb: 3 }}>
                            <InputLabel id="adminPerfil-label">Perfil</InputLabel>
                            <Select
                                labelId="adminPerfil-label"
                                id="adminPerfil"
                                value="admin" // Perfil fixo como 'admin'
                                label="Perfil"
                                disabled // Desabilitado para não permitir alteração
                                variant="outlined"
                            >
                                <MenuItem value="admin">Administrador</MenuItem>
                            </Select>
                        </FormControl>

                        {/* Botões de Ação */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 3 }}>
                            <Button
                                type="submit"
                                variant="contained"
                                color="primary"
                                disabled={loading}
                                sx={{ flexGrow: 1, py: 1.5, fontSize: '1rem', borderRadius: 2 }} // Ajuste de estilo e tamanho
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : 'Registrar Administrador'}
                            </Button>
                            <Button
                                type="button"
                                variant="outlined" // Botão com borda
                                color="secondary" // Usando a cor secundária do tema
                                onClick={() => navigate('/dashboard')}
                                disabled={loading}
                                sx={{ flexGrow: 1, py: 1.5, fontSize: '1rem', borderRadius: 2 }}
                            >
                                Cancelar
                            </Button>
                        </Box>
                    </Box>
                </Box>
            </Paper>
        </Container>
    );
}

export default RegisterAdminPage;
