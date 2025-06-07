import React, { useState, useEffect } from 'react';
import { reports } from '../api';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx'; // Importar LoadingSpinner

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

    if (!user) return <p className="text-center text-danger">Faça login para acessar esta página.</p>;

    return (
        <div className="form-container large-container">
            <h2 className="text-center">Relatório de Recebimentos por Período</h2>

            <form onSubmit={handleGenerateReport} className="filter-form-row">
                <div className="form-group flex-grow">
                    <label htmlFor="startDate">Data de Início:</label>
                    <input
                        type="date"
                        id="startDate"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group flex-grow">
                    <label htmlFor="endDate">Data de Fim:</label>
                    <input
                        type="date"
                        id="endDate"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary">
                    {loading ? 'Gerando...' : 'Gerar Relatório'}
                </button>
            </form>

            {loading && <LoadingSpinner message="Gerando relatório..." />}

            {!loading && !reportData && (
                <p className="text-center no-data-message">Selecione um período e clique em "Gerar Relatório".</p>
            )}

            {reportData && (
                <div className="report-results-section">
                    <h3 className="section-title">Resultados para o Período: {new Date(reportData.start_date).toLocaleDateString()} - {new Date(reportData.end_date).toLocaleDateString()}</h3>
                    <p className="total-receipts-summary">Total Recebido: <strong>R$ {Number(reportData.total_recebido_periodo).toFixed(2)}</strong></p>

                    {reportData.pagamentos.length === 0 ? (
                        <p className="text-center no-data-message">Nenhum pagamento encontrado para o período selecionado.</p>
                    ) : (
                        <table className="styled-table">
                            <thead>
                                <tr>
                                    <th>ID Pagamento</th>
                                    <th>Data</th>
                                    <th>Valor</th>
                                    <th>Forma</th>
                                    <th>Cliente</th>
                                    <th>Carnê</th>
                                    <th>Parcela</th>
                                    <th>Vencimento Original</th>
                                    <th>Observações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.pagamentos.map((pagamento) => (
                                    <tr key={pagamento.id_pagamento}>
                                        <td>{pagamento.id_pagamento}</td>
                                        <td>{new Date(pagamento.data_pagamento).toLocaleDateString()}</td>
                                        <td>R$ {Number(pagamento.valor_pago).toFixed(2)}</td>
                                        <td>{pagamento.forma_pagamento}</td>
                                        <td>{pagamento.cliente_nome}</td>
                                        <td>{pagamento.carnes_descricao || 'N/A'}</td>
                                        <td>{pagamento.parcela_numero}</td>
                                        <td>{new Date(pagamento.parcela_data_vencimento).toLocaleDateString()}</td>
                                        <td>{pagamento.observacoes || 'N/A'}</td>
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

export default ReceiptsReportPage;