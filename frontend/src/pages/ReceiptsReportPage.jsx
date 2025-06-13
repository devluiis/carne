import React, { useState, useEffect } from 'react';
import { reports } from '../api';
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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Grid from '@mui/material/Grid';


// Função auxiliar para formatar moeda (reutilizada)
const formatCurrency = (value) => {
    const num = Number(value);
    if (isNaN(num)) {
        return 'N/A';
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

function ReceiptsReportPage() {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    useEffect(() => {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const format = (date) => date.toISOString().split('T')[0];

        setStartDate(format(firstDayOfMonth));
        setEndDate(format(today));
    }, []);

    const handleGenerateReport = async (e) => {
        e.preventDefault();
        setReportData(null);
        setLoading(true);

        if (!startDate || !endDate) {
            const msg = 'Por favor, selecione as datas de início e fim.';
            setGlobalAlert({ message: msg, type: 'warning' });
            setLoading(false);
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            const msg = 'A data de início não pode ser posterior à data de fim.';
            setGlobalAlert({ message: msg, type: 'warning' });
            setLoading(false);
            return;
        }

        try {
            const response = await reports.getReceiptsReport(startDate, endDate);
            setReportData(response.data);
            setGlobalAlert({ message: 'Relatório de recebimentos gerado com sucesso!', type: 'success' });
        } catch (err) {
            console.error('Erro ao gerar relatório de recebimentos:', err);
            const errorMessage = `Falha ao gerar relatório: ${err.response?.data?.detail || err.message}`;
            setGlobalAlert({ message: errorMessage, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    if (!user) return <Typography color="error" className="text-center p-4">Faça login para acessar esta página.</Typography>;

    return (
        <Container component="main" maxWidth="lg" className="py-8">
            <Typography variant="h4" component="h1" className="mb-6 text-center font-bold text-gray-800">
                Relatório de Recebimentos por Período
            </Typography>

            <Paper elevation={3} className="p-6 mb-8 rounded-lg">
                <Box component="form" onSubmit={handleGenerateReport} noValidate className="flex flex-col sm:flex-row gap-4 items-end">
                    <TextField
                        fullWidth
                        id="startDate"
                        label="Data de Início"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        size="small"
                        className="flex-grow"
                    />
                    <TextField
                        fullWidth
                        id="endDate"
                        label="Data de Fim"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        size="small"
                        className="flex-grow"
                    />
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={loading}
                        className="py-2 px-4"
                    >
                        {loading ? 'Gerando...' : 'Gerar Relatório'}
                    </Button>
                </Box>
            </Paper>

            {loading && <LoadingSpinner message="Gerando relatório..." />}

            {!loading && !reportData && (
                <Typography className="text-center p-4 bg-gray-50 rounded-md text-gray-600 italic">
                    Selecione um período e clique em "Gerar Relatório".
                </Typography>
            )}

            {reportData && (
                <Paper elevation={3} className="p-6 mb-8 rounded-lg">
                    <Typography variant="h5" component="h3" className="mb-4 font-bold text-gray-800">
                        Resultados para o Período: {new Date(reportData.start_date).toLocaleDateString('pt-BR')} - {new Date(reportData.end_date).toLocaleDateString('pt-BR')}
                    </Typography>
                    <Typography variant="h6" className="mb-4 text-green-600 font-bold">
                        Total Recebido: {formatCurrency(reportData.total_recebido_periodo)}
                    </Typography>

                    {reportData.pagamentos.length === 0 ? (
                        <Typography className="text-center p-4 bg-gray-50 rounded-md text-gray-600 italic">
                            Nenhum pagamento encontrado para o período selecionado.
                        </Typography>
                    ) : (
                        <TableContainer>
                            <Table size="small">
                                <TableHead className="bg-gray-200">
                                    <TableRow>
                                        <TableCell>ID Pagamento</TableCell>
                                        <TableCell>Data</TableCell>
                                        <TableCell>Valor</TableCell>
                                        <TableCell>Forma</TableCell>
                                        <TableCell>Cliente</TableCell>
                                        <TableCell>Carnê</TableCell>
                                        <TableCell>Parcela</TableCell>
                                        <TableCell>Vencimento Original</TableCell>
                                        <TableCell>Observações</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {reportData.pagamentos.map((pagamento) => (
                                        <TableRow key={pagamento.id_pagamento} className="hover:bg-gray-50">
                                            <TableCell>{pagamento.id_pagamento}</TableCell>
                                            <TableCell>{new Date(pagamento.data_pagamento).toLocaleDateString('pt-BR')}</TableCell>
                                            <TableCell>{formatCurrency(pagamento.valor_pago)}</TableCell>
                                            <TableCell>{pagamento.forma_pagamento}</TableCell>
                                            <TableCell>{pagamento.cliente_nome}</TableCell>
                                            <TableCell>{pagamento.carnes_descricao || 'N/A'}</TableCell>
                                            <TableCell>{pagamento.parcela_numero}</TableCell>
                                            <TableCell>{new Date(pagamento.parcela_data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                                            <TableCell>{pagamento.observacoes || 'N/A'}</TableCell>
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

export default ReceiptsReportPage;