import React, { useState, useEffect, useCallback } from 'react';
import { reports } from '../api';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

function DashboardPage() {
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth(); 
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
        if (user) { 
            fetchDashboardSummary();
        } else if (!user && !useAuth().loading) { 
            setLoading(false); 
        }
    }, [user, fetchDashboardSummary, useAuth().loading]); 

    if (loading) { 
        return <LoadingSpinner message="Carregando Dashboard..." />;
    }

    if (!summaryData) { 
        return (
            <div className="form-container text-center">
                <h2>Dashboard</h2>
                <p>Não foi possível carregar os dados do dashboard ou não há dados disponíveis.</p>
                <button onClick={fetchDashboardSummary} className="btn btn-primary" style={{width: 'auto'}}>
                    Tentar Novamente
                </button>
            </div>
        );
    }

    return (
        <div className="form-container" style={{maxWidth: '1200px'}}> 
            <h2 className="text-center" style={{marginBottom: '30px'}}>Painel de Controle</h2>
            <div className="dashboard-grid"> {/* Usando a classe CSS */}
                {/* Card Total de Clientes */}
                <div className="card-dashboard">
                    <h3>Total de Clientes</h3>
                    <p className="card-value">{summaryData.total_clientes}</p>
                </div>
                {/* Card Total de Carnês */}
                <div className="card-dashboard">
                    <h3>Total de Carnês</h3>
                    <p className="card-value">{summaryData.total_carnes}</p>
                </div>
                {/* Card Carnês Ativos */}
                <div className="card-dashboard">
                    <h3>Carnês Ativos</h3>
                    <p className="card-value card-value-green">{summaryData.total_carnes_ativos}</p>
                </div>
                {/* Card Carnês Quitados */}
                <div className="card-dashboard">
                    <h3>Carnês Quitados</h3>
                    <p className="card-value card-value-blue">{summaryData.total_carnes_quitados}</p>
                </div>
                {/* Card Carnês em Atraso */}
                <div className="card-dashboard">
                    <h3>Carnês em Atraso</h3>
                    <p className="card-value card-value-red">{summaryData.total_carnes_atrasados}</p>
                </div>
                {/* Card Dívida Geral em Aberto */}
                <div className="card-dashboard">
                    <h3>Dívida Aberta (Total)</h3>
                    <p className="card-value card-value-red">R$ {Number(summaryData.total_divida_geral_aberta).toFixed(2)}</p>
                </div>
                {/* Card Recebido Hoje */}
                <div className="card-dashboard">
                    <h3>Recebido Hoje</h3>
                    <p className="card-value card-value-green">R$ {Number(summaryData.total_recebido_hoje).toFixed(2)}</p>
                </div>
                {/* Card Recebido no Mês */}
                <div className="card-dashboard">
                    <h3>Recebido no Mês</h3>
                    <p className="card-value card-value-green">R$ {Number(summaryData.total_recebido_mes).toFixed(2)}</p>
                </div>
                {/* Card Parcelas a Vencer (7 dias) */}
                <div className="card-dashboard">
                    <h3>Parcelas a Vencer (7d)</h3>
                    <p className="card-value card-value-blue">{summaryData.parcelas_a_vencer_7dias}</p>
                </div>
                {/* Card Parcelas Atrasadas */}
                <div className="card-dashboard">
                    <h3>Parcelas Atrasadas</h3>
                    <p className="card-value card-value-red">{summaryData.parcelas_atrasadas}</p>
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;