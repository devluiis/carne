import React, { useState, useEffect } from 'react';
import { reports } from '../api';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';

function DashboardPage() {
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    useEffect(() => {
        if (user) {
            fetchDashboardSummary();
        } else {
            setLoading(false);
            setGlobalAlert({ message: 'Faça login para ver o dashboard.', type: 'error' });
        }
    }, [user]);

    const fetchDashboardSummary = async () => {
        try {
            setLoading(true);
            const response = await reports.getDashboardSummary();
            setSummaryData(response.data);
        } catch (err) {
            console.error('Erro ao carregar dados do dashboard:', err);
            const errorMessage = `Falha ao carregar dashboard: ${err.response?.data?.detail || err.message}`;
            setGlobalAlert({ message: errorMessage, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <p style={loadingStyle}>Carregando Dashboard...</p>;
    if (!summaryData) return <p style={noDataStyle}>Nenhum dado de dashboard disponível.</p>;

    return (
        <div style={containerStyle}>
            <h2 style={headerStyle}>Detalhes do Dashboard</h2> {/* Alterado de "Dashboard Resumido" para "Detalhes do Dashboard" para ser mais descritivo */}
            <div style={gridContainerStyle}> {/* Este é o contêiner que precisa do estilo grid */}
                <div style={cardStyle}>
                    <h3>Total de Clientes</h3>
                    <p style={cardValueStyle}>{summaryData.total_clientes}</p>
                </div>

                <div style={cardStyle}>
                    <h3>Total de Carnês</h3>
                    <p style={cardValueStyle}>{summaryData.total_carnes}</p>
                </div>

                <div style={cardStyle}>
                    <h3>Carnês Ativos</h3>
                    <p style={cardValueStyleGreen}>{summaryData.total_carnes_ativos}</p>
                </div>

                <div style={cardStyle}>
                    <h3>Carnês Quitados</h3>
                    <p style={cardValueStyleBlue}>{summaryData.total_carnes_quitados}</p>
                </div>

                <div style={cardStyle}>
                    <h3>Carnês em Atraso</h3>
                    <p style={cardValueStyleRed}>{summaryData.total_carnes_atrasados}</p>
                </div>
                
                <div style={cardStyle}>
                    <h3>Dívida Geral em Aberto</h3>
                    <p style={cardValueStyleRed}>R$ {summaryData.total_divida_geral_aberta.toFixed(2)}</p>
                </div>

                <div style={cardStyle}>
                    <h3>Recebido Hoje</h3>
                    <p style={cardValueStyleGreen}>R$ {summaryData.total_recebido_hoje.toFixed(2)}</p>
                </div>

                <div style={cardStyle}>
                    <h3>Recebido no Mês</h3>
                    <p style={cardValueStyleGreen}>R$ {summaryData.total_recebido_mes.toFixed(2)}</p>
                </div>

                <div style={cardStyle}>
                    <h3>Parcelas a Vencer (7 dias)</h3>
                    <p style={cardValueStyleBlue}>{summaryData.parcelas_a_vencer_7dias}</p>
                </div>

                <div style={cardStyle}>
                    <h3>Parcelas Atrasadas</h3>
                    <p style={cardValueStyleRed}>{summaryData.parcelas_atrasadas}</p>
                </div>
            </div>
        </div>
    );
}

// Estilos
const containerStyle = { maxWidth: '1200px', margin: '20px auto', padding: '20px', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', backgroundColor: 'white' };
const headerStyle = { textAlign: 'center', marginBottom: '30px', color: '#333' };
const gridContainerStyle = {
    display: 'grid', // A chave para o layout de grade
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', // Colunas auto-ajustáveis, mínimo de 250px, distribuindo o espaço
    gap: '20px', // Espaçamento entre os itens da grade
    justifyContent: 'center', // Centraliza os itens na grade, se houver espaço extra
};
const cardStyle = {
    backgroundColor: '#f9f9f9',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
};
const cardValueStyle = { fontSize: '2em', fontWeight: 'bold', margin: '10px 0' };
const cardValueStyleGreen = { ...cardValueStyle, color: '#28a745' };
const cardValueStyleRed = { ...cardValueStyle, color: '#dc3545' };
const cardValueStyleBlue = { ...cardValueStyle, color: '#007bff' };

const loadingStyle = { textAlign: 'center', fontSize: '1.2em', color: '#555' };
const errorStyle = { textAlign: 'center', fontSize: '1.2em', color: 'red' };
const noDataStyle = { textAlign: 'center', fontSize: '1.1em', color: '#777' };

export default DashboardPage;