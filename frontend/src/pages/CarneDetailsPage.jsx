import React, { useState, useEffect } from 'react';
import { carnes, parcelas, pagamentos, api } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx'; // Importar ConfirmationModal

// Função auxiliar para estilos de status
const getStatusStyle = (status) => {
    switch (status) {
        case 'Paga':
            return { color: 'green', fontWeight: 'bold' };
        case 'Paga com Atraso':
            return { color: 'darkgreen', fontWeight: 'bold' }; // Cor ligeiramente diferente
        case 'Atrasada':
            return { color: 'red', fontWeight: 'bold' };
        case 'Parcialmente Paga':
            return { color: 'orange', fontWeight: 'bold' };
        case 'Renegociada': // NOVO STATUS
            return { color: 'purple', fontWeight: 'bold' };
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
    const [error, setError] = useState('');
    
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [selectedParcela, setSelectedParcela] = useState(null);

    const [valorPago, setValorPago] = useState('');
    const [formaPagamento, setFormaPagamento] = useState('Dinheiro');
    const [observacoesPagamento, setObservacoesPagamento] = useState('');
    const [dataPagamento, setDataPagamento] = useState(''); // NOVO ESTADO para data do pagamento
    const [paymentFormError, setPaymentFormError] = useState('');
    const [paymentLoading, setPaymentLoading] = useState(false);

    const [showRenegotiateModal, setShowRenegotiateModal] = useState(false); // NOVO
    const [renegotiateParcelaId, setRenegotiateParcelaId] = useState(null); // NOVO
    const [newRenegotiateDueDate, setNewRenegotiateDueDate] = useState(''); // NOVO
    const [newRenegotiateValue, setNewRenegotiateValue] = useState(''); // NOVO
    const [renegotiateLoading, setRenegotiateLoading] = useState(false); // NOVO
    
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
        setDataPagamento(new Date().toISOString().split('T')[0]); // Preenche com a data atual
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
            observacoes: observacoesPagamento,
            data_pagamento: new Date(dataPagamento).toISOString() // Envia como ISO string (datetime)
        };

        try {
            await pagamentos.create(paymentData);
            setGlobalAlert({ message: 'Pagamento registrado com sucesso!', type: 'success' });
            setShowPaymentForm(false);
            fetchCarneDetails(); 
        } catch (err) {
            const errorDetail = err.response?.data?.detail || err.message;
            setPaymentFormError(`Erro: ${errorDetail}`);
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

        // Usar a variável de ambiente VITE_API_BASE_URL para compatibilidade com build
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://carne.onrender.com';
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

    // --- Funções de Renegociação ---
    const handleOpenRenegotiateModal = (parcela) => {
        setRenegotiateParcelaId(parcela.id_parcela);
        setNewRenegotiateDueDate(parcela.data_vencimento); // Preenche com a data atual de vencimento
        setNewRenegotiateValue(parcela.saldo_devedor.toFixed(2)); // Sugere o saldo devedor atual
        setShowRenegotiateModal(true);
    };

    const handleConfirmRenegotiate = async () => {
        setRenegotiateLoading(true);
        try {
            const renegotiationData = {
                new_data_vencimento: newRenegotiateDueDate,
                new_valor_devido: parseFloat(newRenegotiateValue),
                status_parcela_apos_renegociacao: 'Renegociada' // Ou 'Pendente'
            };
            await parcelas.renegotiate(renegotiateParcelaId, renegotiationData);
            setGlobalAlert({ message: 'Parcela renegociada com sucesso!', type: 'success' });
            setShowRenegotiateModal(false);
            fetchCarneDetails(); // Recarrega os detalhes do carnê para ver as mudanças
        } catch (err) {
            const errorDetail = err.response?.data?.detail || err.message;
            setGlobalAlert({ message: `Erro ao renegociar parcela: ${errorDetail}`, type: 'error' });
        } finally {
            setRenegotiateLoading(false);
        }
    };

    const handleCancelRenegotiate = () => {
        setShowRenegotiateModal(false);
        setRenegotiateParcelaId(null);
        setNewRenegotiateDueDate('');
        setNewRenegotiateValue('');
    };


    if (loading) {
        return <LoadingSpinner message="Carregando detalhes do carnê..." />;
    }
    if (error && !carne) {
        return <p className="text-center text-danger">{error}</p>;
    }
    if (!carne) {
        return <p className="text-center">Carnê não encontrado.</p>;
    }

    return (
        <div className="form-container large-container"> {/* Usando large-container para ajustar o max-width */}
            <div className="header-with-button"> {/* Nova classe para o cabeçalho e botão */}
                <h2>Detalhes do Carnê: {carne.descricao || `ID ${carne.id_carne}`}</h2>
                <button 
                    onClick={handleGeneratePdf} 
                    className="btn btn-info" 
                    disabled={pdfLoading}
                >
                    {pdfLoading ? 'Gerando PDF...' : '🖨️ Imprimir Carnê (PDF)'}
                </button>
            </div>

            <div className="carne-info-box"> {/* Nova classe para o bloco de informações */}
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

            <h3 className="section-title">Parcelas:</h3>
            {carne.parcelas && carne.parcelas.length === 0 ? (
                <p className="text-center">Nenhuma parcela para este carnê.</p>
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
                                    <td>R$ {Number(parcela.juros_multa_anterior_aplicada).toFixed(2)}</td> {/* Exibir valor anterior */}
                                    <td>R$ {Number(parcela.valor_pago).toFixed(2)}</td>
                                    <td>R$ {Number(parcela.saldo_devedor).toFixed(2)}</td>
                                    <td>{new Date(parcela.data_vencimento).toLocaleDateString()}</td>
                                    <td>
                                        <span style={getStatusStyle(parcela.status_parcela)}>
                                            {parcela.status_parcela}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="table-actions">
                                        {parcela.status_parcela !== 'Paga' && parcela.status_parcela !== 'Paga com Atraso' && Number(parcela.saldo_devedor) > 0.009 && (
                                            <button
                                                onClick={() => handleRegisterPaymentClick(parcela)}
                                                className="btn btn-success btn-sm"
                                            >
                                                Registrar Pagamento
                                            </button>
                                        )}
                                        {user?.perfil === 'admin' && parcela.status_parcela !== 'Paga' && parcela.status_parcela !== 'Paga com Atraso' && parcela.status_parcela !== 'Cancelada' && (
                                            <button
                                                onClick={() => handleOpenRenegotiateModal(parcela)}
                                                className="btn btn-secondary btn-sm"
                                            >
                                                Renegociar
                                            </button>
                                        )}
                                        </div>
                                    </td>
                                </tr>
                                {parcela.pagamentos && parcela.pagamentos.length > 0 && (
                                    <tr>
                                        <td colSpan="9" className="sub-table-cell"> {/* Colspan ajustado para novas colunas */}
                                            <div className="payments-sub-table-container">
                                                <h4 className="payments-sub-table-title">Pagamentos Registrados:</h4>
                                                <table className="styled-table sub-table">
                                                    <thead>
                                                        <tr>
                                                            <th>ID</th>
                                                            <th>Data Pgto</th> {/* Nome da coluna ajustado */}
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
                <div className="form-container payment-form-section"> {/* Nova classe para o formulário de pagamento */}
                    <h3>Registrar Pagamento para Parcela #{selectedParcela.numero_parcela}</h3>
                    <p>Saldo Devedor Atual (incl. Juros/Multas): <strong className="text-danger">R$ {Number(selectedParcela.saldo_devedor).toFixed(2)}</strong></p>
                    {paymentFormError && <p className="text-danger">{paymentFormError}</p>}
                    <form onSubmit={handlePaymentSubmit}>
                        <div className="form-group">
                            <label htmlFor="dataPagamento">Data do Pagamento:</label> {/* NOVO CAMPO */}
                            <input
                                type="date"
                                id="dataPagamento"
                                value={dataPagamento}
                                onChange={(e) => setDataPagamento(e.target.value)}
                                required
                                className="form-input"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="valorPago">Valor Pago:</label>
                            <input
                                type="number"
                                id="valorPago"
                                step="0.01"
                                value={valorPago}
                                onChange={(e) => setValorPago(e.target.value)}
                                required
                                className="form-input"
                                min="0.01"
                                // max para garantir que não pague mais que o devido, mas com a precisão correta
                                max={Number(selectedParcela.saldo_devedor + 0.01).toFixed(2)} 
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="formaPagamento">Forma de Pagamento:</label>
                            <select id="formaPagamento" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} required className="form-select">
                                <option value="Dinheiro">Dinheiro</option>
                                <option value="PIX">PIX</option>
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                                <option value="Débito">Débito</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="obsPagamento">Observações (Opcional):</label>
                            <textarea id="obsPagamento" value={observacoesPagamento} onChange={(e) => setObservacoesPagamento(e.target.value)} rows="2" className="form-textarea"></textarea>
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

            {/* NOVO: Modal de Renegociação */}
            <ConfirmationModal
                isOpen={showRenegotiateModal}
                title="Renegociar Parcela"
                message={
                    <form className="form-content-in-modal" onSubmit={(e) => e.preventDefault()}>
                        <p>Renegociando Parcela ID: {renegotiateParcelaId}</p>
                        <div className="form-group">
                            <label htmlFor="newDueDate">Nova Data de Vencimento:</label>
                            <input
                                type="date"
                                id="newDueDate"
                                value={newRenegotiateDueDate}
                                onChange={(e) => setNewRenegotiateDueDate(e.target.value)}
                                required
                                className="form-input"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="newRenegotiateValue">Novo Valor Devido (Opcional, ou saldo atual):</label>
                            <input
                                type="number"
                                id="newRenegotiateValue"
                                step="0.01"
                                value={newRenegotiateValue}
                                onChange={(e) => setNewRenegotiateValue(e.target.value)}
                                className="form-input"
                                min="0.00"
                            />
                            <small className="form-text-muted">Se não preenchido, o saldo devedor atual será mantido, mas os juros/multa serão zerados.</small>
                        </div>
                    </form>
                }
                onConfirm={handleConfirmRenegotiate}
                onCancel={handleCancelRenegotiate}
                confirmText={renegotiateLoading ? 'Renegociando...' : 'Confirmar Renegociação'}
                cancelText="Cancelar"
                confirmButtonClass="btn-success"
                isConfirmDisabled={renegotiateLoading || !newRenegotiateDueDate}
            />

            <button onClick={() => navigate('/carnes')} className="btn btn-secondary mt-2">
                Voltar para Lista de Carnês
            </button>
        </div>
    );
}

export default CarneDetailsPage;