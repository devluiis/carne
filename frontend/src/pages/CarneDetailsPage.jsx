import React, { useState, useEffect } from 'react';
import { carnes, parcelas, pagamentos, api } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

// Função auxiliar para estilos de status (mantida do seu código original)
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

function CarneDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [carne, setCarne] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [error, setError] = useState(''); // Erro de carregamento da página
    
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [selectedParcela, setSelectedParcela] = useState(null);

    // Estados para o formulário de pagamento
    const [valorPago, setValorPago] = useState('');
    const [formaPagamento, setFormaPagamento] = useState('Dinheiro');
    const [observacoesPagamento, setObservacoesPagamento] = useState('');
    const [paymentFormError, setPaymentFormError] = useState(''); // Erro específico do form de pagamento
    const [paymentLoading, setPaymentLoading] = useState(false);
    
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    const fetchCarneDetails = async () => {
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
    };
    
    useEffect(() => {
        fetchCarneDetails();
    }, [id]);

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

        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const pdfUrl = `${apiUrl}/carnes/${carne.id_carne}/pdf`;

        try {
            const response = await api.get(pdfUrl, { responseType: 'blob' });
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
        return <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>;
    }
    if (!carne) {
        return <p className="text-center">Carnê não encontrado.</p>;
    }

    return (
        <div className="form-container" style={{maxWidth: '1000px'}}> 
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <h2>Detalhes do Carnê: {carne.descricao || `ID ${carne.id_carne}`}</h2>
                <button 
                    onClick={handleGeneratePdf} 
                    className="btn btn-info" 
                    style={{width: 'auto'}}
                    disabled={pdfLoading}
                >
                    {pdfLoading ? 'Gerando PDF...' : '🖨️ Imprimir Carnê (PDF)'}
                </button>
            </div>

            <div className="form-group" style={{border: '1px solid #eee', padding: '15px', borderRadius: '5px', backgroundColor: '#f9f9f9'}}>
                <p><strong>Cliente:</strong> {carne.cliente ? `${carne.cliente.nome} (${carne.cliente.cpf_cnpj})` : carne.id_cliente}</p>
                <p><strong>Valor Total Original:</strong> R$ {Number(carne.valor_total_original).toFixed(2)}</p>
                <p><strong>Valor de Entrada:</strong> R$ {Number(carne.valor_entrada || 0).toFixed(2)}</p>
                {parseFloat(carne.valor_entrada) > 0 && (
                    <p><strong>Forma de Pagamento da Entrada:</strong> {carne.forma_pagamento_entrada || 'N/A'}</p> 
                )}
                <p><strong>Número de Parcelas:</strong> {carne.numero_parcelas}</p>
                <p><strong>Valor por Parcela (Original):</strong> R$ {Number(carne.valor_parcela_original).toFixed(2)}</p>
                <p><strong>Primeiro Vencimento:</strong> {new Date(carne.data_primeiro_vencimento).toLocaleDateString()}</p>
                <p><strong>Frequência:</strong> {carne.frequencia_pagamento}</p>
                <p><strong>Status do Carnê:</strong> {carne.status_carne}</p>
                <p><strong>Observações:</strong> {carne.observacoes || 'N/A'}</p>
            </div>

            <h3 style={{marginTop: '30px', marginBottom: '15px'}}>Parcelas:</h3>
            {carne.parcelas && carne.parcelas.length === 0 ? (
                <p>Nenhuma parcela para este carnê.</p>
            ) : (
                <table className="styled-table">
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
                                    <td>{parcela.numero_parcela}</td>
                                    <td>R$ {Number(parcela.valor_devido).toFixed(2)}</td>
                                    <td>R$ {Number(parcela.juros_multa).toFixed(2)}</td>
                                    <td>R$ {Number(parcela.valor_pago).toFixed(2)}</td>
                                    <td>R$ {Number(parcela.saldo_devedor).toFixed(2)}</td>
                                    <td>{new Date(parcela.data_vencimento).toLocaleDateString()}</td>
                                    <td>
                                        <span style={getStatusStyle(parcela.status_parcela)}>
                                            {parcela.status_parcela}
                                        </span>
                                    </td>
                                    <td>
                                        {parcela.status_parcela !== 'Paga' && parcela.status_parcela !== 'Paga com Atraso' && Number(parcela.saldo_devedor) > 0.009 && (
                                            <button
                                                onClick={() => handleRegisterPaymentClick(parcela)}
                                                className="btn btn-success btn-sm"
                                            >
                                                Registrar Pagamento
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                {/* Linhas para pagamentos da parcela */}
                                {parcela.pagamentos && parcela.pagamentos.length > 0 && (
                                    <tr>
                                        <td colSpan="8" style={{ padding: '0', borderTop: 'none', borderBottom: '1px solid #ddd'}}>
                                            <div style={{ margin: '10px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '5px' }}>
                                                <h4 style={{ fontSize: '0.9em', marginBottom: '10px', color: '#555' }}>Pagamentos Registrados:</h4>
                                                <table className="styled-table" style={{fontSize: '0.9em'}}>
                                                    <thead>
                                                        <tr>
                                                            <th>ID</th>
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
                                                                <td>{pgto.id_pagamento}</td>
                                                                <td>{new Date(pgto.data_pagamento).toLocaleDateString()}</td>
                                                                <td>R$ {Number(pgto.valor_pago).toFixed(2)}</td>
                                                                <td>{pgto.forma_pagamento}</td>
                                                                <td>{pgto.observacoes || 'N/A'}</td>
                                                                {user?.perfil === 'admin' && (
                                                                    <td>
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
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            )}

            {showPaymentForm && selectedParcela && (
                <div className="form-container" style={{marginTop: '30px', border: '1px solid #ccc', backgroundColor: '#fff'}}>
                    <h3>Registrar Pagamento para Parcela #{selectedParcela.numero_parcela}</h3>
                    <p>Saldo Devedor Atual (incl. Juros/Multas): <strong style={{ color: 'red' }}>R$ {Number(selectedParcela.saldo_devedor).toFixed(2)}</strong></p>
                    {paymentFormError && <p style={{ color: 'red' }}>{paymentFormError}</p>}
                    <form onSubmit={handlePaymentSubmit}>
                        <div className="form-group">
                            <label>Valor Pago:</label>
                            <input
                                type="number"
                                step="0.01"
                                value={valorPago}
                                onChange={(e) => setValorPago(e.target.value)}
                                required
                                className="form-input"
                                min="0.01"
                                max={Number(selectedParcela.saldo_devedor).toFixed(2)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Forma de Pagamento:</label>
                            <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} required className="form-select">
                                <option value="Dinheiro">Dinheiro</option>
                                <option value="PIX">PIX</option>
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                                <option value="Débito">Débito</option>
                                {/* Adicione outras formas se necessário */}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Observações (Opcional):</label>
                            <textarea value={observacoesPagamento} onChange={(e) => setObservacoesPagamento(e.target.value)} rows="2" className="form-textarea"></textarea>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={paymentLoading}>
                            {paymentLoading ? 'Registrando...' : 'Confirmar Pagamento'}
                        </button>
                        <button type="button" onClick={() => setShowPaymentForm(false)} className="btn btn-secondary mt-2">
                            Cancelar
                        </button>
                    </form>
                </div>
            )}

            <button onClick={() => navigate('/carnes')} className="btn btn-secondary mt-2">
                Voltar para Lista de Carnês
            </button>
        </div>
    );
}

export default CarneDetailsPage;