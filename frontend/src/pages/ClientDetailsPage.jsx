import React, { useState, useEffect, useCallback } from 'react';
import { clients, carnes } from '../api';
import { useParams, useNavigate, Link } from 'react-router-dom'; // Importar Link
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

// Importações do Material-UI
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip'; // Para o status dos carnês


// Função auxiliar para formatar moeda (reutilizada)
const formatCurrency = (value) => {
    const num = Number(value);
    if (isNaN(num)) {
        return 'N/A';
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

// Função auxiliar para determinar a cor do chip de status do carnê
const getCarneStatusChipColor = (status) => {
    switch (status.toLowerCase()) {
        case 'quitado': return 'success';
        case 'em atraso': return 'error';
        case 'cancelado': return 'default';
        case 'ativo': return 'primary';
        default: return 'info';
    }
};

function ClientDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [client, setClient] = useState(null);
    const [carnesDoCliente, setCarnesDoCliente] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    const fetchClientAndCarnes = useCallback(async () => {
        try {
            setLoading(true);
            const clientResponse = await clients.getById(id);
            setClient(clientResponse.data);

            const carnesResponse = await carnes.getAll(id);
            setCarnesDoCliente(carnesResponse.data || []);
            setError('');
        } catch (err) {
            console.error('Erro ao carregar detalhes do cliente ou carnês:', err);
            setError('Falha ao carregar dados do cliente. Verifique o ID ou faça login novamente.');
            setGlobalAlert({ message: `Falha ao carregar dados do cliente: ${err.response?.data?.detail || err.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [id, setGlobalAlert]);

    useEffect(() => {
        fetchClientAndCarnes();
    }, [fetchClientAndCarnes]);

    if (loading) return <LoadingSpinner message="Carregando detalhes do cliente..." />;
    if (error && !client) return <Typography color="error" className="text-center p-4">{error}</Typography>;
    if (!client) return <Typography color="info" className="text-center p-4">Cliente não encontrado.</Typography>;

    return (
        <Container component="main" maxWidth="lg" className="py-8">
            <Typography variant="h4" component="h1" className="mb-6 text-center font-bold text-gray-800">
                Resumo do Cliente: {client.nome}
            </Typography>
            
            <Paper elevation={3} className="p-6 mb-8 rounded-lg bg-gray-50">
                <Typography variant="h6" component="h2" className="mb-4 font-semibold text-gray-700">Informações do Cliente</Typography>
                <Box className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-gray-700">
                    <Typography variant="body1"><strong>Nome:</strong> {client.nome}</Typography>
                    <Typography variant="body1"><strong>CPF/CNPJ:</strong> {client.cpf_cnpj}</Typography>
                    <Typography variant="body1"><strong>Endereço:</strong> {client.endereco || 'N/A'}</Typography>
                    <Typography variant="body1"><strong>Telefone:</strong> {client.telefone || 'N/A'}</Typography>
                    <Typography variant="body1"><strong>Email:</strong> {client.email || 'N/A'}</Typography>
                </Box>
                <Box className="mt-6 flex justify-end">
                    <Button
                        variant="outlined"
                        color="secondary"
                        onClick={() => navigate('/clients')}
                        className="py-2 px-4"
                    >
                        Voltar para Lista de Clientes
                    </Button>
                </Box>
            </Paper>

            <Typography variant="h5" component="h2" className="mb-4 font-bold text-gray-800">Carnês Associados:</Typography>
            {carnesDoCliente.length === 0 ? (
                <Typography className="text-center p-4 bg-gray-50 rounded-md text-gray-600 italic">
                    Nenhum carnê associado a este cliente.
                </Typography>
            ) : (
                <TableContainer component={Paper} elevation={3} className="rounded-lg">
                    <Table>
                        <TableHead className="bg-gray-200">
                            <TableRow>
                                <TableCell>Descrição</TableCell>
                                <TableCell>Valor Total</TableCell>
                                <TableCell>Nº Parcelas</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Ações</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {carnesDoCliente.map((carne) => (
                                <TableRow key={carne.id_carne} className="hover:bg-gray-50">
                                    <TableCell>{carne.descricao || `Carnê ID ${carne.id_carne}`}</TableCell>
                                    <TableCell>{formatCurrency(carne.valor_total_original)}</TableCell>
                                    <TableCell>{carne.numero_parcelas}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={carne.status_carne.toUpperCase()}
                                            color={getCarneStatusChipColor(carne.status_carne)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Box className="flex flex-wrap gap-2">
                                            <Button
                                                variant="contained"
                                                color="info"
                                                size="small"
                                                onClick={() => navigate(`/carnes/details/${carne.id_carne}`)}
                                            >
                                                Ver Detalhes
                                            </Button>
                                            <Button
                                                variant="contained"
                                                color="warning"
                                                size="small"
                                                onClick={() => navigate(`/carnes/edit/${carne.id_carne}`)}
                                            >
                                                Editar
                                            </Button>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
}

export default ClientDetailsPage;