import React, { useState, useEffect, useCallback } from 'react';
import { reports, clients } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip'; // Para o status

// Função auxiliar para determinar a cor do chip de status da parcela
const getStatusChipColor = (status) => {
    switch (status.toLowerCase()) {
        case 'paga':
        case 'paga com atraso': return 'success';
        case 'atrasada': return 'error';
        case 'parcialmente paga': return 'warning';
        case 'pendente': return 'primary';
        case 'renegociada': return 'info';
        default: return 'default';
    }
};

// Função auxiliar para formatar moeda (reutilizada)
const formatCurrency = (value) => {
    const num = Number(value);
    if (isNaN(num)) {
        return 'N/A';
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

function PendingDebtsReportPage() {
    const { client_id: clientIdFromUrl } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    const [selectedClientId, setSelectedClientId] = useState('');
    const [clientOptions, setClientOptions] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [loadingClients, setLoadingClients] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);
    const [initialMessage, setInitialMessage] = useState('Selecione um cliente e clique em "Gerar Relatório".');

    const fetchClientOptions = useCallback(async () => {
        try {
            setLoadingClients(true);
            const response = await clients.getAll();
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

    const generateReportForClient = useCallback(async (clientId) => {
        if (!clientId || clientId === '0') {
            setInitialMessage('ID de cliente inválido. Selecione um cliente da lista.');
            setReportData(null);
            return;
        }
        
        setReportData(null);
        setLoadingReport(true);
        setInitialMessage(''); 

        try {
            const response = await reports.getPendingDebtsReportByClient(clientId);
            setReportData(response.data);
            if (!response.data || response.data.parcelas_pendentes.length === 0) {
                 setGlobalAlert({ message: 'Nenhuma dívida pendente encontrada para este cliente.', type: 'info' });
            } else {
                 setGlobalAlert({ message: 'Relatório gerado com sucesso!', type: 'success' });
            }
        } catch (err) {
            console.error('Erro ao gerar relatório de dívidas pendentes:', err);
            const errorMsg = err.response?.status === 404 ?
                             'Cliente não encontrado ou sem dívidas para este relatório.' :
                             `Falha ao gerar relatório: ${err.response?.data?.detail || err.message}`;
            setGlobalAlert({ message: errorMsg, type: 'error' });
            setReportData(null);
        } finally {
            setLoadingReport(false);
        }
    }, [setGlobalAlert]);

    useEffect(() => {
        if (clientIdFromUrl && clientIdFromUrl !== '0' && clientOptions.length > 0) {
            const isValidClient = clientOptions.some(client => String(client.id_cliente) === clientIdFromUrl);
            if (isValidClient) {
                setSelectedClientId(clientIdFromUrl);
                generateReportForClient(clientIdFromUrl);
            } else {
                 setInitialMessage(`Cliente com ID ${clientIdFromUrl} não encontrado. Selecione um cliente da lista.`);
                 setGlobalAlert({message: `Cliente ID ${clientIdFromUrl} inválido na URL.`, type: 'warning'})
                 navigate('/reports/pending-debts-by-client', { replace: true }); 
            }
        } else if (clientIdFromUrl === '0') {
            setInitialMessage('ID de cliente inválido na URL. Selecione um cliente da lista.');
            navigate('/reports/pending-debts-by-client', { replace: true }); 
        } else if (!clientIdFromUrl) {
            setSelectedClientId('');
            setReportData(null);
            setInitialMessage('Selecione um cliente e clique em "Gerar Relatório".');
        }
    }, [clientIdFromUrl, clientOptions, navigate, generateReportForClient, setGlobalAlert]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (selectedClientId && selectedClientId !== "0") {
            generateReportForClient(selectedClientId);
        } else {
            setGlobalAlert({ message: 'Por favor, selecione um cliente válido.', type: 'warning' });
        }
    };
    
    const handleClientSelectionChange = (e) => {
        const newClientId = e.target.value;
        setSelectedClientId(newClientId);
        setReportData(null); 
        setInitialMessage('Clique em "Gerar Relatório" para ver os dados.');
        if (newClientId && newClientId !== '0') {
            navigate(`/reports/pending-debts-by-client/${newClientId}`, { replace: true });
        } else {
            setInitialMessage('Selecione um cliente e clique em "Gerar Relatório".');
            navigate('/reports/pending-debts-by-client', { replace: true });
        }
    };

    if (!user) return <Typography color="error" className="text-center p-4">Faça login para acessar esta página.</Typography>;
    if (loadingClients && clientOptions.length === 0) return <LoadingSpinner message="Carregando lista de clientes..." />;

    return (
        <Container component="main" maxWidth="lg" className="py-8">
            <Typography variant="h4" component="h1" className="mb-6 text-center font-bold text-gray-800">
                Relatório de Dívidas Pendentes por Cliente
            </Typography>

            <Paper elevation={3} className="p-6 mb-8 rounded-lg">
                <Box component="form" onSubmit={handleSubmit} noValidate className="flex flex-col sm:flex-row gap-4 items-end">
                    <FormControl fullWidth margin="normal" size="small" className="flex-grow sm:flex-grow">
                        <InputLabel id="clientReportSelect-label">Cliente</InputLabel>
                        <Select
                            labelId="clientReportSelect-label"
                            id="clientReportSelect"
                            value={selectedClientId}
                            label="Cliente"
                            onChange={handleClientSelectionChange}
                        >
                            <MenuItem value="">
                                <em>-- Selecione um Cliente --</em>
                            </MenuItem>
                            {clientOptions.map(client => (
                                <MenuItem key={client.id_cliente} value={client.id_cliente}>
                                    {client.nome} ({client.cpf_cnpj})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={loadingReport || !selectedClientId || selectedClientId === "0"}
                        className="py-2 px-4"
                    >
                        {loadingReport ? 'Gerando...' : 'Gerar Relatório'}
                    </Button>
                </Box>
            </Paper>

            {loadingReport && <LoadingSpinner message="Gerando relatório..." />}

            {!loadingReport && !reportData && (
                 <Typography className="text-center p-4 bg-gray-50 rounded-md text-gray-600 italic">
                     {initialMessage}
                 </Typography>
            )}

            {reportData && (
                <Paper elevation={3} className="p-6 mb-8 rounded-lg">
                    <Typography variant="h5" component="h3" className="mb-4 font-bold text-gray-800">
                        Dívidas Pendentes para: {reportData.cliente_nome} ({reportData.cliente_cpf_cnpj})
                    </Typography>
                    <Typography variant="h6" className="mb-4 text-red-600 font-bold">
                        Total da Dívida Pendente: {formatCurrency(reportData.total_divida_pendente)}
                    </Typography>

                    {reportData.parcelas_pendentes.length === 0 ? (
                        <Typography className="text-center p-4 bg-gray-50 rounded-md text-gray-600 italic">
                            Nenhuma parcela pendente encontrada para este cliente.
                        </Typography>
                    ) : (
                        <TableContainer>
                            <Table size="small">
                                <TableHead className="bg-gray-200">
                                    <TableRow>
                                        <TableCell>Carnê (Descrição)</TableCell>
                                        <TableCell>Parcela Nº</TableCell>
                                        <TableCell>Vencimento</TableCell>
                                        <TableCell>Valor Devido</TableCell>
                                        <TableCell>Juros/Multa</TableCell>
                                        <TableCell>Valor Pago</TableCell>
                                        <TableCell>Saldo Devedor</TableCell>
                                        <TableCell>Status Parcela</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {reportData.parcelas_pendentes.map((parcela) => (
                                        <TableRow key={parcela.id_parcela} className="hover:bg-gray-50">
                                            <TableCell>{parcela.carnes_descricao || `ID ${parcela.id_carne}`}</TableCell>
                                            <TableCell>{parcela.numero_parcela}</TableCell>
                                            <TableCell>{new Date(parcela.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                                            <TableCell>{formatCurrency(parcela.valor_devido)}</TableCell>
                                            <TableCell>{formatCurrency(parcela.juros_multa)}</TableCell>
                                            <TableCell>{formatCurrency(parcela.valor_pago)}</TableCell>
                                            <TableCell>{formatCurrency(parcela.saldo_devedor)}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={parcela.status_parcela.toUpperCase()}
                                                    color={getStatusChipColor(parcela.status_parcela)}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Paper>
            )}
        </Container>
    );
}

export default PendingDebtsReportPage;