import React, { useState, useEffect, useCallback } from 'react';
import { carnes, parcelas, pagamentos, api } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

// Função auxiliar para classes de badge do Bootstrap
const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'Paga':
        case 'Paga com Atraso':
            return 'success';
        case 'Atrasada':
            return 'danger';
        case 'Parcialmente Paga':
            return 'warning';
        default: // Pendente
            return 'primary';
    }
};

function CarneDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [carne, setCarne] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [selectedParcela, setSelectedParcela] = useState(null);

    const [valorPago, setValorPago] = useState('');
    const [formaPagamento, setFormaPagamento] = useState('Dinheiro');
    const [observacoesPagamento, setObservacoesPagamento] = useState('');
    const [paymentFormError, setPaymentFormError] = useState('');
    const [paymentLoading, setPaymentLoading] = useState(false);
    
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    const fetchCarneDetails = useCallback(async () => {
        try {
            setLoading(true);
            const response = await carnes.getById(id);
            setCarne(response.data);
            setError('');
        } catch (err) {
            console.error('Erro ao carregar detalhes do carnê:', err);
            setError('Falha ao carregar detalhes do carnê.');
            setGlobalAlert({ message: `Falha ao carregar detalhes do carnê: ${err.response?.data?.detail || err.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [id, setGlobalAlert]);
    
    useEffect(() => {
        fetchCarneDetails();
    }, [fetchCarneDetails]);

    const handleRegisterPaymentClick = (parcela) => {
        setSelectedParcela(parcela);
        setValorPago(parcela.saldo_devedor.toFixed(2));
        setFormaPagamento('Dinheiro');
        setObservacoesPagamento('');
        setPaymentFormError('');
        setShowPaymentForm(true);
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        setPaymentFormError('');
        setPaymentLoading(true);

        const paymentData = {
            id_parcela: selectedParcela.id_parcela,
            valor_pago: parseFloat(valorPago),
            forma_pagamento: formaPagamento,
            observacoes: observacoesPagamento
        };

        try {
            await pagamentos.create(paymentData);
            setGlobalAlert({ message: 'Pagamento registrado com sucesso!', type: 'success' });
            setShowPaymentForm(false);
            fetchCarneDetails(); 
        } catch (err) {
            const errorDetail = err.response?.data?.detail || err.message;
            setPaymentFormError(`Erro: ${errorDetail}`); // Erro local no form
            setGlobalAlert({ message: `Erro ao registrar pagamento: ${errorDetail}`, type: 'error' });
        } finally {
            setPaymentLoading(false);
        }
    };

    const handleEstornarPagamento = async (pagamentoId) => {
        if (window.confirm('Tem certeza que deseja estornar este pagamento? Esta ação é irreversível.')) {
            try {
                await pagamentos.delete(pagamentoId);
                setGlobalAlert({ message: 'Pagamento estornado com sucesso!', type: 'success' });
                fetchCarneDetails();
            } catch (err) {
                const errorDetail = err.response?.data?.detail || err.message;
                setGlobalAlert({ message: `Falha ao estornar pagamento: ${errorDetail}`, type: 'error' });
            }
        }
    };
    
    const handleGeneratePdf = async () => {
        if (!carne) return;
        setPdfLoading(true);
        setGlobalAlert({message: "Gerando PDF do carnê...", type: "info"});

        const pdfEndpoint = `/carnes/${carne.id_carne}/pdf`; 

        try {
            const response = await api.get(pdfEndpoint, { responseType: 'blob' });
            
            const file = new Blob([response.data], { type: 'application/pdf' });
            const fileURL = URL.createObjectURL(file);
            window.open(fileURL, '_blank');
            setGlobalAlert({message: "PDF pronto para visualização!", type: "success"});
        } catch (err) {
            console.error('Erro ao gerar PDF:', err);
            let errorDetail = "Falha ao gerar o PDF.";
            if (err.response?.data instanceof Blob && err.response?.data.type === "application/json") {
                try {
                    const errorJsonText = await err.response.data.text();
                    const parsedError = JSON.parse(errorJsonText);
                    errorDetail = parsedError.detail || "Erro no servidor ao gerar PDF.";
                } catch { /* Mantém o errorDetail genérico */ }
            } else {
                errorDetail = err.response?.data?.detail || err.message || errorDetail;
            }
            setGlobalAlert({ message: `Erro ao gerar PDF: ${errorDetail}`, type: 'error' });
        } finally {
            setPdfLoading(false);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Carregando detalhes do carnê..." />;
    }
    if (error && !carne) {
        return <p className="text-center text-danger p-3">{error}</p>;
    }
    if (!carne) {
        return <p className="text-center">Carnê não encontrado.</p>;
    }

    return (
        <div className="container form-container"> {/* container do Bootstrap */}
            <div className="d-flex justify-content-between align-items-center mb-4"> {/* d-flex do Bootstrap */}
                <h2 className="mb-0">Detalhes do Carnê: {carne.descricao || `ID ${carne.id_carne}`}</h2> {/* mb-0 do Bootstrap */}
                <button 
                    onClick={handleGeneratePdf} 
                    className="btn btn-info" 
                    disabled={pdfLoading}
                >
                    {pdfLoading ? 'Gerando PDF...' : '🖨️ Imprimir Carnê (PDF)'}
                </button>
            </div>

            <div className="card mb-4 p-3 bg-light"> {/* card mb-4 p-3 bg-light do Bootstrap */}
                <p><strong>Cliente:</strong> {carne.cliente ? `${carne.cliente.nome} (${carne.cliente.cpf_cnpj})` : carne.id_cliente}</p>
                <p><strong>Valor Total Original:</strong> R$ {Number(carne.valor_total_original).toFixed(2)}</p>
                <p><strong>Valor de Entrada:</strong> R$ {Number(carne.valor_entrada || 0).toFixed(2)}</p>
                {parseFloat(carne.valor_entrada) > 0 && (
                    <p><strong>Forma de Pagamento da Entrada:</strong> {carne.forma_pagamento_entrada || 'N/A'}</p> 
                )}
                <p><strong>Número de Parcelas:</strong> {carne.numero_parcelas}</p>
                <p><strong>Valor por Parcela (Original):</strong> R$ {Number(carne.valor_parcela_original).toFixed(2)}</p>
                <p><strong>Primeiro Vencimento:</strong> {new Date(carne.data_primeiro_vencimento + 'T00:00:00').toLocaleDateString()}</p>
                <p><strong>Frequência:</strong> {carne.frequencia_pagamento}</p>
                <p><strong>Status do Carnê:</strong> {carne.status_carne}</p>
                <p><strong>Observações:</strong> {carne.observacoes || 'N/A'}</p>
            </div>

            <h3 className="mb-3">Parcelas:</h3> {/* mb-3 do Bootstrap */}
            {carne.parcelas && carne.parcelas.length === 0 ? (
                <p className="text-center">Nenhuma parcela para este carnê.</p>
            ) : (
                <div className="table-responsive"> {/* table-responsive do Bootstrap */}
                    <table className="table table-striped table-hover"> {/* Classes de tabela do Bootstrap */}
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Valor Devido</th>
                                <th>Juros/Multa</th>
                                <th>Valor Pago</th>
                                <th>Saldo Devedor</th>
                                <th>Vencimento</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {carne.parcelas.map((parcela) => (
                                <React.Fragment key={parcela.id_parcela}>
                                    <tr>
                                        <td data-label="#">{parcela.numero_parcela}</td>
                                        <td data-label="Valor Devido">R$ {Number(parcela.valor_devido).toFixed(2)}</td>
                                        <td data-label="Juros/Multa">R$ {Number(parcela.juros_multa).toFixed(2)}</td>
                                        <td data-label="Valor Pago">R$ {Number(parcela.valor_pago).toFixed(2)}</td>
                                        <td data-label="Saldo Devedor">R$ {Number(parcela.saldo_devedor).toFixed(2)}</td>
                                        <td data-label="Vencimento">{new Date(parcela.data_vencimento).toLocaleDateString()}</td>
                                        <td data-label="Status">
                                            <span className={`badge bg-${getStatusBadgeClass(parcela.status_parcela)}`}> {/* Classe para badge do Bootstrap */}
                                                {parcela.status_parcela}
                                            </span>
                                        </td>
                                        <td data-label="Ações">
                                            <div className="d-flex flex-wrap gap-2"> {/* d-flex flex-wrap gap-2 do Bootstrap */}
                                                {parcela.status_parcela !== 'Paga' && parcela.saldo_devedor > 0.01 && (
                                                    <button
                                                        onClick={() => handleRegisterPaymentClick(parcela)}
                                                        className="btn btn-success btn-sm"
                                                    >
                                                        Registrar Pagamento
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    {/* Linhas para pagamentos da parcela */}
                                    {parcela.pagamentos && parcela.pagamentos.length > 0 && (
                                        <tr>
                                            <td colSpan="8" className="p-0 border-0"> {/* p-0 border-0 do Bootstrap */}
                                                <div className="card my-2 p-3 bg-light"> {/* card my-2 p-3 bg-light do Bootstrap */}
                                                    <h4 className="fs-6 mb-2 text-muted">Pagamentos Registrados:</h4> {/* fs-6 mb-2 text-muted do Bootstrap */}
                                                    <div className="table-responsive"> {/* table-responsive para a sub-tabela */}
                                                        <table className="table table-sm table-striped"> {/* table-sm table-striped do Bootstrap */}
                                                            <thead>
                                                                <tr>
                                                                    <th>ID Pagamento</th>
                                                                    <th>Data</th>
                                                                    <th>Valor Pago</th>
                                                                    <th>Forma</th>
                                                                    <th>Obs.</th>
                                                                    {user?.perfil === 'admin' && <th>Ações</th>}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {parcela.pagamentos.map((pgto) => (
                                                                    <tr key={pgto.id_pagamento}>
                                                                        <td data-label="ID Pagamento">{pgto.id_pagamento}</td>
                                                                        <td data-label="Data">{new Date(pgto.data_pagamento).toLocaleDateString()}</td>
                                                                        <td data-label="Valor Pago">R$ {pgto.valor_pago.toFixed(2)}</td>
                                                                        <td data-label="Forma">{pgto.forma_pagamento}</td>
                                                                        <td data-label="Observações">{pgto.observacoes || 'N/A'}</td>
                                                                        {user?.perfil === 'admin' && (
                                                                            <td data-label="Ações">
                                                                                <button
                                                                                    onClick={() => handleEstornarPagamento(pgto.id_pagamento)}
                                                                                    className="btn btn-danger btn-sm"
                                                                                >
                                                                                    Estornar
                                                                                </button>
                                                                            </td>
                                                                        )}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showPaymentForm && selectedParcela && (
                <div className="card p-4 mt-4"> {/* card p-4 mt-4 do Bootstrap */}
                    <h3 className="mb-3">Registrar Pagamento para Parcela #{selectedParcela.numero_parcela}</h3>
                    <p className="mb-3">Saldo Devedor Atual (incl. Juros/Multas): <strong className="text-danger">R$ {selectedParcela.saldo_devedor.toFixed(2)}</strong></p>
                    {paymentFormError && <p className="text-danger mb-3">{paymentFormError}</p>}
                    <form onSubmit={handlePaymentSubmit}>
                        <div className="mb-3">
                            <label htmlFor="valorPago" className="form-label">Valor Pago:</label>
                            <input
                                type="number"
                                id="valorPago"
                                step="0.01"
                                value={valorPago}
                                onChange={(e) => setValorPago(e.target.value)}
                                required
                                className="form-control"
                                min="0.01"
                                max={selectedParcela.saldo_devedor.toFixed(2)}
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="formaPagamento" className="form-label">Forma de Pagamento:</label>
                            <select
                                id="formaPagamento"
                                value={formaPagamento}
                                onChange={(e) => setFormaPagamento(e.target.value)}
                                required
                                className="form-select"
                            >
                                <option value="Dinheiro">Dinheiro</option>
                                <option value="PIX">PIX</option>
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                                <option value="Débito">Débito</option>
                            </select>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="observacoesPagamento" className="form-label">Observações (Opcional):</label>
                            <textarea
                                id="observacoesPagamento"
                                value={observacoesPagamento}
                                onChange={(e) => setObservacoesPagamento(e.target.value)}
                                rows="2"
                                className="form-control"
                            ></textarea>
                        </div>
                        <button type="submit" className="btn btn-primary w-100" disabled={paymentLoading}>
                            {paymentLoading ? 'Registrando...' : 'Confirmar Pagamento'}
                        </button>
                        <button type="button" onClick={() => setShowPaymentForm(false)} className="btn btn-secondary w-100 mt-2">
                            Cancelar
                        </button>
                    </form>
                </div>
            )}

            <button onClick={() => navigate('/carnes')} className="btn btn-secondary w-100 mt-4"> {/* w-100 mt-4 do Bootstrap */}
                Voltar para Lista de Carnês
            </button>
        </div>
    );
}

export default CarneDetailsPage;