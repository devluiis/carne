import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clients } from '../api';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

// Importações do Material-UI
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';

function NovaVendaPage() {
    const [clientOptions, setClientOptions] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [loadingClients, setLoadingClients] = useState(true);
    
    const navigate = useNavigate();
    const { setGlobalAlert } = useGlobalAlert();

    const fetchClientOptions = useCallback(async () => {
        try {
            setLoadingClients(true);
            const response = await clients.getAll('');
            setClientOptions(response.data || []);
        } catch (err) {
            console.error('Erro ao carregar opções de clientes:', err);
            setGlobalAlert({ message: 'Falha ao carregar lista de clientes.', type: 'error' });
        } finally {
            setLoadingClients(false);
        }
    }, [setGlobalAlert]);

    useEffect(() => {
        fetchClientOptions();
    }, [fetchClientOptions]);

    const handleProceedToCarne = () => {
        if (!selectedClientId) {
            setGlobalAlert({ message: 'Por favor, selecione um cliente para prosseguir.', type: 'warning' });
            return;
        }
        navigate(`/carnes/new/${selectedClientId}`);
    };

    if (loadingClients) {
        return <LoadingSpinner message="Carregando lista de clientes..." />;
    }

    return (
        <Container component="main" maxWidth="md" className="flex flex-col items-center justify-center min-h-screen py-8">
            <Paper elevation={3} className="p-6 mb-8 rounded-lg w-full max-w-lg">
                <Typography variant="h5" component="h1" className="mb-4 text-center font-bold text-gray-800">
                    Registrar Nova Venda / Carnê
                </Typography>
                <Typography variant="body1" className="mb-6 text-center text-gray-700">
                    Selecione o cliente para o qual deseja registrar uma nova venda e gerar um carnê.
                </Typography>
                
                <FormControl fullWidth margin="normal" className="mb-6">
                    <InputLabel id="client-select-label">Cliente *</InputLabel>
                    <Select
                        labelId="client-select-label"
                        id="client-select"
                        value={selectedClientId}
                        label="Cliente *"
                        onChange={(e) => setSelectedClientId(e.target.value)}
                    >
                        <MenuItem value="">
                            <em>-- Selecione um Cliente --</em>
                        </MenuItem>
                        {clientOptions.length > 0 ? (
                            clientOptions.map(client => (
                                <MenuItem key={client.id_cliente} value={client.id_cliente}>
                                    {client.nome} ({client.cpf_cnpj})
                                </MenuItem>
                            ))
                        ) : (
                            <MenuItem value="" disabled>Nenhum cliente cadastrado</MenuItem>
                        )}
                    </Select>
                </FormControl>

                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleProceedToCarne}
                    disabled={!selectedClientId || loadingClients}
                    className="py-3 text-lg font-semibold w-full mb-4"
                >
                    Prosseguir para Criação do Carnê
                </Button>

                <Box className="flex flex-col sm:flex-row gap-4 justify-end mt-4">
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => navigate('/clients/new')}
                        className="py-2 px-4 flex-grow sm:flex-grow-0"
                    >
                        + Cadastrar Novo Cliente
                    </Button>
                    <Button
                        variant="outlined"
                        color="secondary"
                        onClick={() => navigate('/carnes')}
                        className="py-2 px-4 flex-grow sm:flex-grow-0"
                    >
                        Cancelar / Ver Carnês
                    </Button>
                </Box>
            </Paper>
        </Container>
    );
}

export default NovaVendaPage;