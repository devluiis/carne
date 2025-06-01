import React, { useState, useEffect } from 'react';
import { reports, clients } from '../api'; // Importar reports e clients
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';

function PendingDebtsReportPage() {
    const { client_id } = useParams(); // Pode vir de um link com ID do cliente ou ser selecionado no formulário
    const navigate = useNavigate();
    const [selectedClientId, setSelectedClientId] = useState(client_id || '');
    const [clientOptions, setClientOptions] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { user } = useAuth();

    useEffect(() => {
        fetchClientOptions();
        if (client_id) {
            handleGenerateReport(null, client_id); // Gerar o relatório se o ID do cliente vier da URL
        }
    }, [client_id, user]);

    const fetchClientOptions = async () => {
        try {
            const response = await clients.getAll();
            setClientOptions(response.data);
        } catch (err) {
            console.error('Erro ao carregar opções de clientes:', err);
        }
    };

    const handleGenerateReport = async (e, idFromUrl = null) => {
        if (e) e.preventDefault(); // Previne o comportamento padrão do formulário se chamado por evento

        const targetClientId = idFromUrl || selectedClientId;

        setError('');
        setReportData(null);
        setLoading(true);

        if (!targetClientId) {
            setError('Por favor, selecione um cliente para gerar o relatório.');
            setLoading(false);
            return;
        }

        try {
            const response = await reports.getPendingDebtsReportByClient(targetClientId);
            setReportData(response.data);
            setError('');
        } catch (err) {
            console.error('Erro ao gerar relatório de dívidas pendentes:', err);
            setError(`Falha ao gerar relatório: ${err.response?.data?.detail || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!user) return <p style={errorStyle}>Faça login para acessar esta página.</p>;

    return (
        <div style={containerStyle}>
            <h2 style={headerStyle}>Relatório de Dívidas Pendentes por Cliente</h2>

            <form onSubmit={handleGenerateReport} style={formStyle}>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Cliente:</label>
                    <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        required
                        style={inputStyle}
                    >
                        <option value="">-- Selecione um Cliente --</option>
                        {clientOptions.map(client => (
                            <option key={client.id_cliente} value={client.id_cliente}>
                                {client.nome} ({client.cpf_cnpj})
                            </option>
                        ))}
                    </select>
                </div>
                <button type="submit" disabled={loading || !selectedClientId} style={submitButtonStyle}>
                    {loading ? 'Gerando...' : 'Gerar Relatório'}
                </button>
            </form>

            {error && <p style={{ ...errorStyle, marginTop: '20px' }}>{error}</p>}

            {reportData && (
                <div style={reportResultsStyle}>
                    <h3 style={reportHeaderStyle}>Dívidas Pendentes para: {reportData.cliente_nome} ({reportData.cliente_cpf_cnpj})</h3>
                    <p style={totalStyle}>Total da Dívida Pendente: <strong>R$ {reportData.total_divida_pendente.toFixed(2)}</strong></p>

                    {reportData.parcelas_pendentes.length === 0 ? (
                        <p style={noDataStyle}>Nenhuma parcela pendente encontrada para este cliente.</p>
                    ) : (
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={tableHeaderStyle}>Carnê</th>
                                    <th style={tableHeaderStyle}>Parcela</th>
                                    <th style={tableHeaderStyle}>Vencimento</th>
                                    <th style={tableHeaderStyle}>Valor Devido (Original)</th>
                                    <th style={tableHeaderStyle}>Juros/Multa</th>
                                    <th style={tableHeaderStyle}>Valor Pago</th>
                                    <th style={tableHeaderStyle}>Saldo Devedor</th>
                                    <th style={tableHeaderStyle}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.parcelas_pendentes.map((parcela) => (
                                    <tr key={parcela.id_parcela}>
                                        <td style={tableCellStyle}>{parcela.carnes_descricao || `ID ${parcela.id_carne}`}</td>
                                        <td style={tableCellStyle}>{parcela.numero_parcela}</td>
                                        <td style={tableCellStyle}>{new Date(parcela.data_vencimento).toLocaleDateString()}</td>
                                        <td style={tableCellStyle}>R$ {parcela.valor_devido.toFixed(2)}</td>
                                        <td style={tableCellStyle}>R$ {parcela.juros_multa.toFixed(2)}</td>
                                        <td style={tableCellStyle}>R$ {parcela.valor_pago.toFixed(2)}</td>
                                        <td style={tableCellStyle}>R$ {parcela.saldo_devedor.toFixed(2)}</td>
                                        <td style={tableCellStyle}>
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

// Função auxiliar para estilos de status (para melhor visualização)
const getStatusStyle = (status) => {
    switch (status) {
        case 'Paga':
        case 'Paga com Atraso':
            return { color: 'green', fontWeight: 'bold' };
        case 'Atrasada':
            return { color: 'red', fontWeight: 'bold' };
        case 'Parcialmente Paga':
            return { color: 'orange', fontWeight: 'bold' };
        default: // Pendente
            return { color: 'blue', fontWeight: 'bold' };
    }
};

// Estilos (reutilizados ou adaptados de ReceiptsReportPage)
const containerStyle = { maxWidth: '1000px', margin: '20px auto', padding: '20px', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', backgroundColor: 'white' };
const headerStyle = { textAlign: 'center', marginBottom: '30px', color: '#333' };
const formStyle = { display: 'flex', gap: '15px', marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9', alignItems: 'flex-end' };
const formGroupStyle = { flex: '1', minWidth: '150px' };
const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' };
const submitButtonStyle = { padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', minWidth: '120px' };

const reportResultsStyle = { marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' };
const reportHeaderStyle = { fontSize: '1.5em', marginBottom: '15px', color: '#333' };
const totalStyle = { fontSize: '1.2em', marginBottom: '20px', color: '#dc3545' }; // Dívida em vermelho
const tableStyle = { width: '100%', borderCollapse: 'collapse', marginTop: '10px' };
const tableHeaderStyle = { borderBottom: '1px solid #ddd', padding: '12px', textAlign: 'left', backgroundColor: '#f2f2f2' };
const tableCellStyle = { borderBottom: '1px solid #eee', padding: '10px', fontSize: '0.9em' };

const loadingStyle = { textAlign: 'center', fontSize: '1.2em', color: '#555' };
const errorStyle = { textAlign: 'center', fontSize: '1.2em', color: 'red' };
const noDataStyle = { textAlign: 'center', fontSize: '1.1em', color: '#777', padding: '20px', backgroundColor: '#f2f2f2', borderRadius: '8px' };

export default PendingDebtsReportPage;