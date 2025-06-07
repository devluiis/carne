import React, { useState, useEffect, useCallback } from 'react';
import { reports, clients } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const getStatusStyle = (status) => {
    switch (status) {
        case 'Paga':
        case 'Paga com Atraso':
            return { color: '#28a745', fontWeight: 'bold' };
        case 'Atrasada':
            return { color: '#dc3545', fontWeight: 'bold' };
        case 'Parcialmente Paga':
            return { color: '#fd7e14', fontWeight: 'bold' };
        case 'Pendente':
        default:
            return { color: '#007bff', fontWeight: 'bold' };
    }
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

    if (!user) return <p className="text-center text-danger p-3">Faça login para acessar esta página.</p>;
    if (loadingClients && clientOptions.length === 0) return <LoadingSpinner message="Carregando lista de clientes..." />;

    return (
        <div className="container form-container" style={{maxWidth: '1000px'}}> 
            <h2 className="text-center mb-4">Relatório de Dívidas Pendentes por Cliente</h2>

            <form onSubmit={handleSubmit} className="row g-3 align-items-end mb-4 border-bottom pb-3"> 
                <div className="col-md-8"> 
                    <label htmlFor="client-select" className="form-label">Cliente:</label>
                    <select
                        id="client-select"
                        value={selectedClientId}
                        onChange={handleClientSelectionChange}
                        className="form-select"
                    >
                        <option value="">-- Selecione um Cliente --</option>
                        {clientOptions.map(client => (
                            <option key={client.id_cliente} value={client.id_cliente}>
                                {client.nome} ({client.cpf_cnpj})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="col-md-4"> 
                    <button type="submit" className="btn btn-primary w-100" disabled={loadingReport || !selectedClientId || selectedClientId === "0"}>
                        {loadingReport ? 'Gerando...' : 'Gerar Relatório'}
                    </button>
                </div>
            </form>

            {loadingReport && <LoadingSpinner message="Gerando relatório..." />}

            {!loadingReport && !reportData && (
                 <p className="text-center p-3 bg-light rounded">{initialMessage}</p>
            )}

            {reportData && (
                <div className="mt-4"> 
                    <h3 className="mb-3">Dívidas Pendentes para: {reportData.cliente_nome} ({reportData.cliente_cpf_cnpj})</h3>
                    <p className="fs-5 mb-3">Total da Dívida Pendente: <strong className="text-danger">R$ {Number(reportData.total_divida_pendente).toFixed(2)}</strong></p>

                    {reportData.parcelas_pendentes.length === 0 ? (
                        <p className="text-center p-3 bg-light rounded">Nenhuma parcela pendente encontrada para este cliente.</p>
                    ) : (
                        <div className="table-responsive"> 
                            <table className="table table-striped table-hover">
                                <thead>
                                    <tr>
                                        <th>Carnê (Descrição)</th>
                                        <th>Parcela Nº</th>
                                        <th>Vencimento</th>
                                        <th>Valor Devido</th>
                                        <th>Juros/Multa</th>
                                        <th>Valor Pago</th>
                                        <th>Saldo Devedor</th>
                                        <th>Status Parcela</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.parcelas_pendentes.map((parcela) => (
                                        <tr key={parcela.id_parcela}>
                                            <td data-label="Carnê">{parcela.carnes_descricao || `ID ${parcela.id_carne}`}</td>
                                            <td data-label="Parcela Nº">{parcela.numero_parcela}</td>
                                            <td data-label="Vencimento">{new Date(parcela.data_vencimento + 'T00:00:00').toLocaleDateString()}</td>
                                            <td data-label="Valor Devido">R$ {Number(parcela.valor_devido).toFixed(2)}</td>
                                            <td data-label="Juros/Multa">R$ {Number(parcela.juros_multa).toFixed(2)}</td>
                                            <td data-label="Valor Pago">R$ {Number(parcela.valor_pago).toFixed(2)}</td>
                                            <td data-label="Saldo Devedor">R$ {Number(parcela.saldo_devedor).toFixed(2)}</td>
                                            <td data-label="Status Parcela">
                                                <span className={`badge bg-${getStatusBadgeClass(parcela.status_parcela)}`}>
                                                    {parcela.status_parcela}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'Paga': return 'success';
        case 'Paga com Atraso': return 'success';
        case 'Atrasada': return 'danger';
        case 'Parcialmente Paga': return 'warning';
        case 'Pendente': default: return 'primary';
    }
};

export default PendingDebtsReportPage;