import React, { useState, useEffect, useCallback } from 'react';
import { reports, clients } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

// Função auxiliar para estilos de status (pode ser movida para um utils.js se usada em mais lugares)
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
            setSelectedClientId(''); // Limpa seleção se não houver ID na URL
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
            // Se selecionar "-- Selecione --", limpa o ID da URL e a mensagem inicial
            setInitialMessage('Selecione um cliente e clique em "Gerar Relatório".');
            navigate('/reports/pending-debts-by-client', { replace: true });
        }
    };

    if (!user) return <p className="text-center" style={{color: 'red', padding: '20px'}}>Faça login para acessar esta página.</p>;
    if (loadingClients && clientOptions.length === 0) return <LoadingSpinner message="Carregando lista de clientes..." />;

    return (
        <div className="form-container" style={{maxWidth: '1000px'}}>
            <h2 className="text-center">Relatório de Dívidas Pendentes por Cliente</h2>

            <form onSubmit={handleSubmit} className="form-group" style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', borderBottom: '1px solid #eee', paddingBottom: '20px', marginBottom: '20px' }}>
                <div style={{flexGrow: 1}}>
                    <label>Cliente:</label>
                    <select
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
                <button type="submit" className="btn btn-primary" disabled={loadingReport || !selectedClientId || selectedClientId === "0"} style={{width: 'auto'}}>
                    {loadingReport ? 'Gerando...' : 'Gerar Relatório'}
                </button>
            </form>

            {loadingReport && <LoadingSpinner message="Gerando relatório..." />}

            {!loadingReport && !reportData && (
                 <p className="text-center" style={{padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '5px'}}>{initialMessage}</p>
            )}

            {reportData && (
                <div style={{marginTop: '20px'}}>
                    <h3 style={{marginBottom: '10px'}}>Dívidas Pendentes para: {reportData.cliente_nome} ({reportData.cliente_cpf_cnpj})</h3>
                    <p style={{fontSize: '1.1em', marginBottom: '15px'}}>Total da Dívida Pendente: <strong style={{color: '#dc3545'}}>R$ {Number(reportData.total_divida_pendente).toFixed(2)}</strong></p>

                    {reportData.parcelas_pendentes.length === 0 ? (
                        <p className="text-center" style={{padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '5px'}}>Nenhuma parcela pendente encontrada para este cliente.</p>
                    ) : (
                        <table className="styled-table">
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
                                        <td>{parcela.carnes_descricao || `ID ${parcela.id_carne}`}</td>
                                        <td>{parcela.numero_parcela}</td>
                                        <td>{new Date(parcela.data_vencimento + 'T00:00:00').toLocaleDateString()}</td>
                                        <td>R$ {Number(parcela.valor_devido).toFixed(2)}</td>
                                        <td>R$ {Number(parcela.juros_multa).toFixed(2)}</td>
                                        <td>R$ {Number(parcela.valor_pago).toFixed(2)}</td>
                                        <td>R$ {Number(parcela.saldo_devedor).toFixed(2)}</td>
                                        <td>
                                            <span style={getStatusStyle(parcela.status_parcela)}>
                                                {parcela.status_parcela}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}

export default PendingDebtsReportPage;