import React, { useState, useEffect, useCallback } from 'react';
import { reports } from '../api';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

// Importações do Material-UI
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper'; // Para os cards do dashboard
import Button from '@mui/material/Button'; // Para o botão de tentar novamente

function DashboardPage() {
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(true);
    const { user, loading: authLoading } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    const fetchDashboardSummary = useCallback(async () => {
        try {
            setLoading(true);
            const response = await reports.getDashboardSummary();
            setSummaryData(response.data);
        } catch (err) {
            console.error('Erro ao carregar dados do dashboard:', err);
            const errorMessage = `Falha ao carregar dashboard: ${err.response?.data?.detail || err.message}`;
            setGlobalAlert({ message: errorMessage, type: 'error' });
            setSummaryData(null);
        } finally {
            setLoading(false);
        }
    }, [setGlobalAlert]);

    useEffect(() => {
        if (!authLoading && user) {
            fetchDashboardSummary();
        } else if (!authLoading && !user) {
            setLoading(false);
        }
    }, [user, fetchDashboardSummary, authLoading]);

    if (loading) {
        return <LoadingSpinner message="Carregando Dashboard..." />;
    }

    if (!summaryData) {
        return (
            <Container component="main" maxWidth="md" className="flex flex-col items-center justify-center min-h-screen py-8">
                <Paper elevation={3} className="p-6 mb-8 rounded-lg text-center w-full max-w-md">
                    <Typography variant="h5" component="h2" className="mb-4 font-bold text-gray-800">
                        Dashboard
                    </Typography>
                    <Typography className="mb-6 text-gray-700">
                        Não foi possível carregar os dados do dashboard ou não há dados disponíveis.
                    </Typography>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={fetchDashboardSummary}
                    >
                        Tentar Novamente
                    </Button>
                </Paper>
            </Container>
        );
    }

    // Função auxiliar para determinar a cor do texto do card (apenas para este componente, não global)
    const getCardValueColorClass = (valueType) => {
        switch (valueType) {
            case 'green': return 'text-green-600';
            case 'red': return 'text-red-600';
            case 'blue': return 'text-blue-600';
            default: return 'text-gray-900';
        }
    };

    return (
        <Container component="main" maxWidth="lg" className="py-8">
            <Typography variant="h4" component="h1" className="mb-8 text-center font-bold text-gray-800">
                Painel de Controle
            </Typography>
            <Box className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"> {/* Tailwind para grid responsivo */}
                <Paper elevation={3} className="p-5 rounded-lg text-center bg-gray-50 flex flex-col justify-between items-center h-full"> {/* Card individual */}
                    <Typography variant="h6" component="h3" className="mb-2 font-semibold text-gray-700">Total de Clientes</Typography>
                    <Typography variant="h4" component="p" className={`font-bold ${getCardValueColorClass()}`}>
                        {summaryData.total_clientes}
                    </Typography>
                </Paper>
                <Paper elevation={3} className="p-5 rounded-lg text-center bg-gray-50 flex flex-col justify-between items-center h-full">
                    <Typography variant="h6" component="h3" className="mb-2 font-semibold text-gray-700">Total de Carnês</Typography>
                    <Typography variant="h4" component="p" className={`font-bold ${getCardValueColorClass()}`}>
                        {summaryData.total_carnes}
                    </Typography>
                </Paper>
                <Paper elevation={3} className="p-5 rounded-lg text-center bg-green-50 flex flex-col justify-between items-center h-full">
                    <Typography variant="h6" component="h3" className="mb-2 font-semibold text-gray-700">Carnês Ativos</Typography>
                    <Typography variant="h4" component="p" className={`font-bold ${getCardValueColorClass('green')}`}>
                        {summaryData.total_carnes_ativos}
                    </Typography>
                </Paper>
                <Paper elevation={3} className="p-5 rounded-lg text-center bg-blue-50 flex flex-col justify-between items-center h-full">
                    <Typography variant="h6" component="h3" className="mb-2 font-semibold text-gray-700">Carnês Quitados</Typography>
                    <Typography variant="h4" component="p" className={`font-bold ${getCardValueColorClass('blue')}`}>
                        {summaryData.total_carnes_quitados}
                    </Typography>
                </Paper>
                <Paper elevation={3} className="p-5 rounded-lg text-center bg-red-50 flex flex-col justify-between items-center h-full">
                    <Typography variant="h6" component="h3" className="mb-2 font-semibold text-gray-700">Carnês em Atraso</Typography>
                    <Typography variant="h4" component="p" className={`font-bold ${getCardValueColorClass('red')}`}>
                        {summaryData.total_carnes_atrasados}
                    </Typography>
                </Paper>
                <Paper elevation={3} className="p-5 rounded-lg text-center bg-red-50 flex flex-col justify-between items-center h-full">
                    <Typography variant="h6" component="h3" className="mb-2 font-semibold text-gray-700">Dívida Aberta (Total)</Typography>
                    <Typography variant="h4" component="p" className={`font-bold ${getCardValueColorClass('red')}`}>
                        R$ {Number(summaryData.total_divida_geral_aberta).toFixed(2)}
                    </Typography>
                </Paper>
                <Paper elevation={3} className="p-5 rounded-lg text-center bg-green-50 flex flex-col justify-between items-center h-full">
                    <Typography variant="h6" component="h3" className="mb-2 font-semibold text-gray-700">Recebido Hoje</Typography>
                    <Typography variant="h4" component="p" className={`font-bold ${getCardValueColorClass('green')}`}>
                        R$ {Number(summaryData.total_recebido_hoje).toFixed(2)}
                    </Typography>
                </Paper>
                <Paper elevation={3} className="p-5 rounded-lg text-center bg-green-50 flex flex-col justify-between items-center h-full">
                    <Typography variant="h6" component="h3" className="mb-2 font-semibold text-gray-700">Recebido no Mês</Typography>
                    <Typography variant="h4" component="p" className={`font-bold ${getCardValueColorClass('green')}`}>
                        R$ {Number(summaryData.total_recebido_mes).toFixed(2)}
                    </Typography>
                </Paper>
                <Paper elevation={3} className="p-5 rounded-lg text-center bg-blue-50 flex flex-col justify-between items-center h-full">
                    <Typography variant="h6" component="h3" className="mb-2 font-semibold text-gray-700">Parcelas a Vencer (7d)</Typography>
                    <Typography variant="h4" component="p" className={`font-bold ${getCardValueColorClass('blue')}`}>
                        {summaryData.parcelas_a_vencer_7dias}
                    </Typography>
                </Paper>
                <Paper elevation={3} className="p-5 rounded-lg text-center bg-red-50 flex flex-col justify-between items-center h-full">
                    <Typography variant="h6" component="h3" className="mb-2 font-semibold text-gray-700">Parcelas Atrasadas</Typography>
                    <Typography variant="h4" component="p" className={`font-bold ${getCardValueColorClass('red')}`}>
                        {summaryData.parcelas_atrasadas}
                    </Typography>
                </Paper>
            </Box>
        </Container>
    );
}

export default DashboardPage;