import React, { useState, useEffect } from 'react';
import { reports } from '../api';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx'; // Importar useGlobalAlert

function ReceiptsReportPage() {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(''); // Manter erro local para carregamento
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert(); // Usar o contexto do alerta global


    // Opcional: Definir datas padrão para o mês atual ao carregar a página
    useEffect(() => {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        // Formata as datas para YYYY-MM-DD
        const format = (date) => date.toISOString().split('T')[0];

        setStartDate(format(firstDayOfMonth));
        setEndDate(format(today));
    }, []);

    const handleGenerateReport = async (e) => {
        e.preventDefault();
        setError('');
        setReportData(null); // Limpa dados de relatórios anteriores
        setLoading(true);

        if (!startDate || !endDate) {
            const msg = 'Por favor, selecione as datas de início e fim.';
            setError(msg);
            setGlobalAlert({ message: msg, type: 'warning' });
            setLoading(false);
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            const msg = 'A data de início não pode ser posterior à data de fim.';
            setError(msg);
            setGlobalAlert({ message: msg, type: 'warning' });
            setLoading(false);
            return;
        }

        try {
            const response = await reports.getReceiptsReport(startDate, endDate);
            setReportData(response.data);
            setGlobalAlert({ message: 'Relatório de recebimentos gerado com sucesso!', type: 'success' });
            setError('');
        } catch (err) {
            console.error('Erro ao gerar relatório de recebimentos:', err);
            const errorMessage = `Falha ao gerar relatório: ${err.response?.data?.detail || err.message}`;
            setError(errorMessage);
            setGlobalAlert({ message: errorMessage, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    if (!user) return <p style={errorStyle}>Faça login para acessar esta página.</p>;

    return (
        <div style={containerStyle}>
            <h2 style={headerStyle}>Relatório de Recebimentos por Período</h2>

            <form onSubmit={handleGenerateReport} style={formStyle}>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Data de Início:</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        style={inputStyle}
                    />
                </div>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Data de Fim:</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                        style={inputStyle}
                    />
                </div>
                <button type="submit" disabled={loading} style={submitButtonStyle}>
                    {loading ? 'Gerando...' : 'Gerar Relatório'}
                </button>
            </form>

            {error && <p style={{ ...errorStyle, marginTop: '20px' }}>{error}</p>}

            {reportData && (
                <div style={reportResultsStyle}>
                    <h3 style={reportHeaderStyle}>Resultados para o Período: {new Date(reportData.start_date).toLocaleDateString()} - {new Date(reportData.end_date).toLocaleDateString()}</h3>
                    <p style={totalStyle}>Total Recebido: <strong>R$ {reportData.total_recebido_periodo.toFixed(2)}</strong></p>

                    {reportData.pagamentos.length === 0 ? (
                        <p style={noDataStyle}>Nenhum pagamento encontrado para o período selecionado.</p>
                    ) : (
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={tableHeaderStyle}>ID Pagamento</th>
                                    <th style={tableHeaderStyle}>Data</th>
                                    <th style={tableHeaderStyle}>Valor</th>
                                    <th style={tableHeaderStyle}>Forma</th>
                                    <th style={tableHeaderStyle}>Cliente</th>
                                    <th style={tableHeaderStyle}>Carnê</th>
                                    <th style={tableHeaderStyle}>Parcela</th>
                                    <th style={tableHeaderStyle}>Vencimento Original</th>
                                    <th style={tableHeaderStyle}>Observações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.pagamentos.map((pagamento) => (
                                    <tr key={pagamento.id_pagamento}>
                                        <td style={tableCellStyle}>{pagamento.id_pagamento}</td>
                                        <td style={tableCellStyle}>{new Date(pagamento.data_pagamento).toLocaleDateString()}</td>
                                        <td style={tableCellStyle}>R$ {pagamento.valor_pago.toFixed(2)}</td>
                                        <td style={tableCellStyle}>{pagamento.forma_pagamento}</td>
                                        <td style={tableCellStyle}>{pagamento.cliente_nome}</td>
                                        <td style={tableCellStyle}>{pagamento.carnes_descricao || 'N/A'}</td>
                                        <td style={tableCellStyle}>{pagamento.parcela_numero}</td>
                                        <td style={tableCellStyle}>{new Date(pagamento.parcela_data_vencimento).toLocaleDateString()}</td>
                                        <td style={tableCellStyle}>{pagamento.observacoes || 'N/A'}</td>
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

// Estilos
const containerStyle = { maxWidth: '1000px', margin: '20px auto', padding: '20px', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', backgroundColor: 'white' };
const headerStyle = { textAlign: 'center', marginBottom: '30px', color: '#333' };
const formStyle = { display: 'flex', gap: '15px', marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9', alignItems: 'flex-end' };
const formGroupStyle = { flex: '1', minWidth: '150px' };
const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' };
const submitButtonStyle = { padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', minWidth: '120px' };

const reportResultsStyle = { marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' };
const reportHeaderStyle = { fontSize: '1.5em', marginBottom: '15px', color: '#333' };
const totalStyle = { fontSize: '1.2em', marginBottom: '20px', color: '#28a745' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', marginTop: '10px' };
const tableHeaderStyle = { borderBottom: '1px solid #ddd', padding: '12px', textAlign: 'left', backgroundColor: '#f2f2f2' };
const tableCellStyle = { borderBottom: '1px solid #eee', padding: '10px', fontSize: '0.9em' };

const loadingStyle = { textAlign: 'center', fontSize: '1.2em', color: '#555' };
const errorStyle = { textAlign: 'center', fontSize: '1.2em', color: 'red' };
const noDataStyle = { textAlign: 'center', fontSize: '1.1em', color: '#777', padding: '20px', backgroundColor: '#f2f2f2', borderRadius: '8px' };

export default ReceiptsReportPage;