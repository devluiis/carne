import React, { useState, useEffect } from 'react';
import { clients } from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';

// Importações do Material-UI
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress'; // Para o spinner de loading

function ClientForm() {
    const [nome, setNome] = useState('');
    const [cpfCnpj, setCpfCnpj] = useState('');
    const [endereco, setEndereco] = useState('');
    const [telefone, setTelefone] = useState('');
    const [email, setEmail] = useState('');
    const [loadingInitial, setLoadingInitial] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const navigate = useNavigate();
    const { id } = useParams();
    const { setGlobalAlert } = useGlobalAlert();

    useEffect(() => {
        if (id) {
            setLoadingInitial(true);
            clients.getById(id)
                .then(response => {
                    const client = response.data;
                    setNome(client.nome);
                    setCpfCnpj(client.cpf_cnpj);
                    setEndereco(client.endereco || '');
                    setTelefone(client.telefone || '');
                    setEmail(client.email || '');
                })
                .catch(err => {
                    console.error('Erro ao carregar cliente para edição:', err);
                    setGlobalAlert({ message: 'Erro ao carregar dados do cliente.', type: 'error' });
                    navigate('/clients');
                })
                .finally(() => setLoadingInitial(false));
        }
    }, [id, navigate, setGlobalAlert]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        const clientData = { nome, cpf_cnpj: cpfCnpj, endereco, telefone, email };

        try {
            if (id) {
                await clients.update(id, clientData);
                setGlobalAlert({ message: 'Cliente atualizado com sucesso!', type: 'success' });
            } else {
                await clients.create(clientData);
                setGlobalAlert({ message: 'Cliente cadastrado com sucesso!', type: 'success' });
            }
            navigate('/clients');
        } catch (err) {
            const errorMessage = `Erro ao salvar cliente: ${err.response?.data?.detail || err.message}`;
            setGlobalAlert({ message: errorMessage, type: 'error' }); // Usar GlobalAlert em vez de setError local
            console.error(err);
        } finally {
            setSubmitLoading(false);
        }
    };

    if (loadingInitial) {
        return <LoadingSpinner message="Carregando dados do cliente..." />;
    }

    return (
        <Container component="main" maxWidth="sm" className="flex items-center justify-center min-h-screen-minus-header py-8">
            <Box
                sx={{
                    p: 4, // padding-4 (Tailwind equivalent)
                    borderRadius: 2, // rounded-lg
                    boxShadow: 3, // shadow-md
                    bgcolor: 'background.paper', // bg-white
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
                className="w-full max-w-lg mx-auto" // Tailwind classes for responsive width and centering
            >
                <Typography component="h1" variant="h5" className="mb-6 font-bold text-gray-800">
                    {id ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
                </Typography>
                
                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }} className="w-full">
                    {/* Campos do Formulário */}
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="nome"
                        label="Nome Completo / Razão Social"
                        name="nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="mb-4"
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="cpfCnpj"
                        label="CPF / CNPJ"
                        name="cpfCnpj"
                        value={cpfCnpj}
                        onChange={(e) => setCpfCnpj(e.target.value)}
                        className="mb-4"
                    />
                    <TextField
                        margin="normal"
                        fullWidth
                        id="endereco"
                        label="Endereço"
                        name="endereco"
                        value={endereco}
                        onChange={(e) => setEndereco(e.target.value)}
                        className="mb-4"
                    />
                    <TextField
                        margin="normal"
                        fullWidth
                        id="telefone"
                        label="Telefone"
                        name="telefone"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        className="mb-4"
                    />
                    <TextField
                        margin="normal"
                        fullWidth
                        id="email"
                        label="Email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mb-6"
                    />

                    {/* Botões de Ação */}
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 2, mb: 2 }} // mt-2, mb-2 (Tailwind equivalent)
                        disabled={submitLoading}
                        className="py-3 text-lg font-semibold"
                    >
                        {submitLoading ? <CircularProgress size={24} color="inherit" /> : (id ? 'Atualizar Cliente' : 'Cadastrar Cliente')}
                    </Button>
                    <Button
                        type="button"
                        fullWidth
                        variant="outlined" // Use outlined para o botão cancelar
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

export default ClientForm;