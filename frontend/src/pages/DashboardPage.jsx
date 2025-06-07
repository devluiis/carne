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
            <div className="container form-container text-center"> 
                <h2 className="mb-4">Dashboard</h2> 
                <p>Não foi possível carregar os dados do dashboard ou não há dados disponíveis.</p>
                <button onClick={fetchDashboardSummary} className="btn btn-primary mt-3"> 
                    Tentar Novamente
                </button>
            </div>
        );
    }

    return (
        <div className="container form-container"> 
            <h2 className="text-center mb-4">Painel de Controle</h2> 
            <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3"> 
                <div className="col">
                    <div className="card text-center p-3 shadow-sm"> 
                        <h3 className="fs-6">Total de Clientes</h3> 
                        <p className="fs-4 fw-bold text-dark">{summaryData.total_clientes}</p> 
                    </div>
                </div>
                <div className="col">
                    <div className="card text-center p-3 shadow-sm">
                        <h3 className="fs-6">Total de Carnês</h3>
                        <p className="fs-4 fw-bold text-dark">{summaryData.total_carnes}</p>
                    </div>
                </div>
                <div className="col">
                    <div className="card text-center p-3 shadow-sm">
                        <h3 className="fs-6">Carnês Ativos</h3>
                        <p className="fs-4 fw-bold text-primary">{summaryData.total_carnes_ativos}</p> 
                    </div>
                </div>
                <div className="col">
                    <div className="card text-center p-3 shadow-sm">
                        <h3 className="fs-6">Carnês Quitados</h3>
                        <p className="fs-4 fw-bold text-success">{summaryData.total_carnes_quitados}</p> 
                    </div>
                </div>
                <div className="col">
                    <div className="card text-center p-3 shadow-sm">
                        <h3 className="fs-6">Carnês em Atraso</h3>
                        <p className="fs-4 fw-bold text-danger">{summaryData.total_carnes_atrasados}</p> 
                    </div>
                </div>
                <div className="col">
                    <div className="card text-center p-3 shadow-sm">
                        <h3 className="fs-6">Dívida Aberta (Total)</h3>
                        <p className="fs-4 fw-bold text-danger">R$ {Number(summaryData.total_divida_geral_aberta).toFixed(2)}</p>
                    </div>
                </div>
                <div className="col">
                    <div className="card text-center p-3 shadow-sm">
                        <h3 className="fs-6">Recebido Hoje</h3>
                        <p className="fs-4 fw-bold text-success">R$ {Number(summaryData.total_recebido_hoje).toFixed(2)}</p>
                    </div>
                </div>
                <div className="col">
                    <div className="card text-center p-3 shadow-sm">
                        <h3 className="fs-6">Recebido no Mês</h3>
                        <p className="fs-4 fw-bold text-success">R$ {Number(summaryData.total_recebido_mes).toFixed(2)}</p>
                    </div>
                </div>
                <div className="col">
                    <div className="card text-center p-3 shadow-sm">
                        <h3 className="fs-6">Parcelas a Vencer (7d)</h3>
                        <p className="fs-4 fw-bold text-primary">{summaryData.parcelas_a_vencer_7dias}</p>
                    </div>
                </div>
                <div className="col">
                    <div className="card text-center p-3 shadow-sm">
                        <h3 className="fs-6">Parcelas Atrasadas</h3>
                        <p className="fs-4 fw-bold text-danger">{summaryData.parcelas_atrasadas}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;