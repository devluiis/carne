import React, { useState, useEffect } from 'react';
import { reports } from '../api';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx'; 
import LoadingSpinner from '../components/LoadingSpinner.jsx';

function ReceiptsReportPage() {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(''); 
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
        setError('');
        setReportData(null); 
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

    if (!user) return <p className="text-center" style={{color: 'red', padding: '20px'}}>Faça login para acessar esta página.</p>;

    return (
        <div className="form-container" style={{maxWidth: '1000px'}}> 
            <h2 className="text-center">Relatório de Recebimentos por Período</h2>

            <form onSubmit={handleGenerateReport} className="form-grid-2-col" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', alignItems: 'flex-end', borderBottom: '1px solid #eee', paddingBottom: '20px', marginBottom: '20px' }}> {/* Usando form-grid-2-col */}
                <div className="form-group">
                    <label>Data de Início:</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>Data de Fim:</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{width: 'auto'}}>
                    {loading ? 'Gerando...' : 'Gerar Relatório'}
                </button>
            </form>

            {error && <p className="text-center" style={{ ...errorStyle, marginTop: '20px' }}>{error}</p>}

            {reportData && (
                <div style={{marginTop: '20px'}}>
                    <h3 style={{marginBottom: '10px'}}>Resultados para o Período: {new Date(reportData.start_date).toLocaleDateString()} - {new Date(reportData.end_date).toLocaleDateString()}</h3>
                    <p style={{fontSize: '1.1em', marginBottom: '15px'}}>Total Recebido: <strong style={{color: '#28a745'}}>R$ {Number(reportData.total_recebido_periodo).toFixed(2)}</strong></p>

                    {reportData.pagamentos.length === 0 ? (
                        <p className="text-center" style={{padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '5px'}}>Nenhum pagamento encontrado para o período selecionado.</p>
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
                                        <td data-label="ID Pagamento">{pagamento.id_pagamento}</td>
                                        <td data-label="Data">{new Date(pagamento.data_pagamento).toLocaleDateString()}</td>
                                        <td data-label="Valor">R$ {pagamento.valor_pago.toFixed(2)}</td>
                                        <td data-label="Forma">{pagamento.forma_pagamento}</td>
                                        <td data-label="Cliente">{pagamento.cliente_nome}</td>
                                        <td data-label="Carnê">{pagamento.carnes_descricao || 'N/A'}</td>
                                        <td data-label="Parcela">{pagamento.parcela_numero}</td>
                                        <td data-label="Vencimento Original">{new Date(pagamento.parcela_data_vencimento).toLocaleDateString()}</td>
                                        <td data-label="Observações">{pagamento.observacoes || 'N/A'}</td>
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

const errorStyle = { textAlign: 'center', fontSize: '1.2em', color: 'red' };

export default ReceiptsReportPage;