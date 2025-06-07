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

    if (!user) return <p className="text-center text-danger p-3">Faça login para acessar esta página.</p>;

    return (
        <div className="container form-container"> {/* container do Bootstrap */}
            <h2 className="text-center mb-4">Relatório de Recebimentos por Período</h2>

            <form onSubmit={handleGenerateReport} className="row g-3 align-items-end mb-4 border-bottom pb-3"> {/* row g-3 do Bootstrap */}
                <div className="col-md-5"> {/* col-md-5 do Bootstrap */}
                    <label htmlFor="startDate" className="form-label">Data de Início:</label>
                    <input
                        type="date"
                        id="startDate"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        className="form-control" /* form-control do Bootstrap */
                    />
                </div>
                <div className="col-md-5"> {/* col-md-5 do Bootstrap */}
                    <label htmlFor="endDate" className="form-label">Data de Fim:</label>
                    <input
                        type="date"
                        id="endDate"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                        className="form-control"
                    />
                </div>
                <div className="col-md-2"> {/* col-md-2 do Bootstrap */}
                    <button type="submit" className="btn btn-primary w-100" disabled={loading}> {/* w-100 do Bootstrap */}
                        {loading ? 'Gerando...' : 'Gerar Relatório'}
                    </button>
                </div>
            </form>

            {error && <p className="text-center text-danger mt-3">{error}</p>} {/* Classes Bootstrap */}

            {reportData && (
                <div className="mt-4"> {/* mt-4 do Bootstrap */}
                    <h3 className="mb-3">Resultados para o Período: {new Date(reportData.start_date).toLocaleDateString()} - {new Date(reportData.end_date).toLocaleDateString()}</h3>
                    <p className="fs-5 mb-3">Total Recebido: <strong className="text-success">R$ {Number(reportData.total_recebido_periodo).toFixed(2)}</strong></p> {/* fs-5 text-success do Bootstrap */}

                    {reportData.pagamentos.length === 0 ? (
                        <p className="text-center p-3 bg-light rounded">Nenhum pagamento encontrado para o período selecionado.</p>
                    ) : (
                        <div className="table-responsive"> {/* table-responsive do Bootstrap */}
                            <table className="table table-striped table-hover">
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
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default ReceiptsReportPage;