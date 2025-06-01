import React, { useState, useEffect } from 'react';
import { carnes, parcelas, pagamentos } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx'; // Importar useGlobalAlert

function CarneDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [carne, setCarne] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(''); // Manter erro local para carregamento
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [selectedParcela, setSelectedParcela] = useState(null);

    // Estado para o formulário de pagamento
    const [valorPago, setValorPago] = useState('');
    const [formaPagamento, setFormaPagamento] = useState('Dinheiro');
    const [observacoesPagamento, setObservacoesPagamento] = useState('');
    const [paymentFormError, setPaymentFormError] = useState(''); // Manter erro local para formulário
    const [paymentLoading, setPaymentLoading] = useState(false);
    
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert(); // Usar o contexto do alerta global


    useEffect(() => {
        fetchCarneDetails();
    }, [id]);

    const fetchCarneDetails = async () => {
        try {
            setLoading(true);
            const response = await carnes.getById(id);
            setCarne(response.data);
            setError('');
        } catch (err) {
            console.error('Erro ao carregar detalhes do carnê:', err);
            setError('Falha ao carregar detalhes do carnê. Verifique o ID ou faça login novamente.');
            setGlobalAlert({ message: `Falha ao carregar detalhes do carnê: ${err.response?.data?.detail || err.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterPaymentClick = (parcela) => {
        setSelectedParcela(parcela);
        // Preenche com o saldo devedor ATUALIZADO (já incluindo juros/multas do backend)
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
            fetchCarneDetails(); // Recarrega os detalhes do carnê para atualizar as parcelas
        } catch (err) {
            console.error('Erro ao registrar pagamento:', err);
            const errorMessage = `Erro ao registrar pagamento: ${err.response?.data?.detail || err.message}`;
            setPaymentFormError(errorMessage); // Erro no formulário de pagamento
            setGlobalAlert({ message: errorMessage, type: 'error' }); // Alerta global
        } finally {
            setPaymentLoading(false);
        }
    };

    const handleEstornarPagamento = async (pagamentoId) => {
        if (window.confirm('Tem certeza que deseja estornar este pagamento? Esta ação é irreversível e pode afetar o status da parcela.')) {
            try {
                await pagamentos.delete(pagamentoId);
                setGlobalAlert({ message: 'Pagamento estornado com sucesso!', type: 'success' });
                fetchCarneDetails(); // Recarrega os detalhes do carnê para refletir o estorno
            } catch (err) {
                console.error('Erro ao estornar pagamento:', err);
                const errorMessage = `Falha ao estornar pagamento: ${err.response?.data?.detail || err.message}`;
                setError(errorMessage); // Erro na página
                setGlobalAlert({ message: errorMessage, type: 'error' }); // Alerta global
            }
        }
    };

    const handleUpdateParcelaStatus = async (parcelaId, newStatus) => {
        // Esta função de 'Marcar Atrasada' se torna menos necessária
        // pois o backend agora atualiza o status automaticamente ao buscar as parcelas.
        // Mantemos aqui para compatibilidade e se houver um caso de uso específico para forçar o status.
        if (window.confirm(`Tem certeza que deseja mudar o status desta parcela para "${newStatus}"?`)) {
            try {
                await parcelas.update(parcelaId, { status_parcela: newStatus });
                setGlobalAlert({ message: 'Status da parcela atualizado!', type: 'success' });
                fetchCarneDetails(); // Recarrega os detalhes do carnê
            } catch (err) {
                console.error('Erro ao atualizar status da parcela:', err);
                const errorMessage = `Falha ao atualizar status da parcela: ${err.response?.data?.detail || err.message}`;
                setError(errorMessage); // Erro na página
                setGlobalAlert({ message: errorMessage, type: 'error' }); // Alerta global
            }
        }
    };

    if (loading) return <p>Carregando detalhes do carnê...</p>;
    if (error && !carne) return <p style={{ color: 'red' }}>{error}</p>;
    if (!carne) return <p>Carnê não encontrado.</p>;

    return (
        <div style={carneDetailsContainerStyle}>
            <h2 style={detailsHeaderStyle}>Detalhes do Carnê: {carne.descricao || `ID ${carne.id_carne}`}</h2>
            <div style={carneInfoStyle}>
                <p>
                    <strong>Cliente:</strong>{' '}
                    {carne.cliente ? `${carne.cliente.nome} (${carne.cliente.cpf_cnpj})` : carne.id_cliente}
                </p>
                <p><strong>Valor Total Original:</strong> R$ {carne.valor_total_original.toFixed(2)}</p>
                <p><strong>Número de Parcelas:</strong> {carne.numero_parcelas}</p>
                <p><strong>Valor por Parcela:</strong> R$ {carne.valor_parcela_original.toFixed(2)}</p>
                <p><strong>Primeiro Vencimento:</strong> {new Date(carne.data_primeiro_vencimento).toLocaleDateString()}</p>
                <p><strong>Frequência:</strong> {carne.frequencia_pagamento}</p>
                <p><strong>Status do Carnê:</strong> {carne.status_carne}</p>
                <p><strong>Observações:</strong> {carne.observacoes || 'N/A'}</p>
            </div>

            <h3 style={parcelasHeaderStyle}>Parcelas:</h3>
            {carne.parcelas && carne.parcelas.length === 0 ? (
                <p>Nenhuma parcela para este carnê.</p>
            ) : (
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={tableHeaderStyle}>#</th>
                            <th style={tableHeaderStyle}>Valor Devido</th>
                            <th style={tableHeaderStyle}>Juros/Multa</th>
                            <th style={tableHeaderStyle}>Valor Pago</th>
                            <th style={tableHeaderStyle}>Saldo Devedor</th>
                            <th style={tableHeaderStyle}>Vencimento</th>
                            <th style={tableHeaderStyle}>Status</th>
                            <th style={tableHeaderStyle}>Ações da Parcela</th>
                        </tr>
                    </thead>
                    <tbody>
                        {carne.parcelas.map((parcela) => (
                            <React.Fragment key={parcela.id_parcela}>
                                <tr>
                                    <td style={tableCellStyle}>{parcela.numero_parcela}</td>
                                    <td style={tableCellStyle}>R$ {parcela.valor_devido.toFixed(2)}</td>
                                    <td style={tableCellStyle}>R$ {parcela.juros_multa.toFixed(2)}</td>
                                    <td style={tableCellStyle}>R$ {parcela.valor_pago.toFixed(2)}</td>
                                    <td style={tableCellStyle}>R$ {parcela.saldo_devedor.toFixed(2)}</td>
                                    <td style={tableCellStyle}>{new Date(parcela.data_vencimento).toLocaleDateString()}</td>
                                    <td style={tableCellStyle}>
                                        <span style={getStatusStyle(parcela.status_parcela)}>
                                            {parcela.status_parcela}
                                        </span>
                                    </td>
                                    <td style={tableCellStyle}>
                                        {/* Botão de Registrar Pagamento: Habilitado se a parcela não estiver paga e ainda tiver saldo devedor */}
                                        {parcela.status_parcela !== 'Paga' && parcela.saldo_devedor > 0.01 && (
                                            <button
                                                onClick={() => handleRegisterPaymentClick(parcela)}
                                                style={{ ...actionButtonStyle, backgroundColor: '#28a745' }}
                                            >
                                                Registrar Pagamento
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                {/* Linhas para pagamentos da parcela */}
                                {parcela.pagamentos && parcela.pagamentos.length > 0 && (
                                    <tr>
                                        <td colSpan="8" style={{ padding: '0', border: 'none' }}>
                                            <div style={pagamentosSubTableContainerStyle}>
                                                <h4 style={pagamentosSubTableHeaderStyle}>Pagamentos Registrados:</h4>
                                                <table style={pagamentosSubTableStyle}>
                                                    <thead>
                                                        <tr>
                                                            <th style={pagamentosSubTableHeaderCellStyle}>ID Pagamento</th>
                                                            <th style={pagamentosSubTableHeaderCellStyle}>Data Pagamento</th>
                                                            <th style={pagamentosSubTableHeaderCellStyle}>Valor Pago</th>
                                                            <th style={pagamentosSubTableHeaderCellStyle}>Forma</th>
                                                            <th style={pagamentosSubTableHeaderCellStyle}>Observações</th>
                                                            {user && user.perfil === 'admin' && (
                                                                <th style={pagamentosSubTableHeaderCellStyle}>Ações</th>
                                                            )}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {parcela.pagamentos.map((pagamento) => (
                                                            <tr key={pagamento.id_pagamento}>
                                                                <td style={pagamentosSubTableCellStyle}>{pagamento.id_pagamento}</td>
                                                                <td style={pagamentosSubTableCellStyle}>{new Date(pagamento.data_pagamento).toLocaleDateString()}</td>
                                                                <td style={pagamentosSubTableCellStyle}>R$ {pagamento.valor_pago.toFixed(2)}</td>
                                                                <td style={pagamentosSubTableCellStyle}>{pagamento.forma_pagamento}</td>
                                                                <td style={pagamentosSubTableCellStyle}>{pagamento.observacoes || 'N/A'}</td>
                                                                {user && user.perfil === 'admin' && (
                                                                    <td style={pagamentosSubTableCellStyle}>
                                                                        <button
                                                                            onClick={() => handleEstornarPagamento(pagamento.id_pagamento)}
                                                                            style={{ ...actionButtonStyle, backgroundColor: '#dc3545', fontSize: '0.75em' }}
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
                <div style={paymentFormContainerStyle}>
                    <h3>Registrar Pagamento para Parcela #{selectedParcela.numero_parcela}</h3>
                    {/* Exibe o saldo devedor atualizado, incluindo juros/multas */}
                    <p>Saldo Devedor Atual (incl. Juros/Multas): <strong style={{ color: 'red' }}>R$ {selectedParcela.saldo_devedor.toFixed(2)}</strong></p>
                    {paymentFormError && <p style={{ color: 'red' }}>{paymentFormError}</p>}
                    <form onSubmit={handlePaymentSubmit}>
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Valor Pago:</label>
                            <input
                                type="number"
                                step="0.01"
                                value={valorPago}
                                onChange={(e) => setValorPago(e.target.value)}
                                required
                                style={inputStyle}
                                // O valor inicial já é o saldo_devedor total, incluindo juros/multas
                                // o min/max pode ser útil, mas o backend já valida
                                min="0.01"
                                max={selectedParcela.saldo_devedor.toFixed(2)}
                            />
                        </div>
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Forma de Pagamento:</label>
                            <select
                                value={formaPagamento}
                                onChange={(e) => setFormaPagamento(e.target.value)}
                                required
                                style={inputStyle}
                            >
                                <option value="Dinheiro">Dinheiro</option>
                                <option value="PIX">PIX</option>
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                                <option value="Débito">Débito</option>
                            </select>
                        </div>
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Observações (Opcional):</label>
                            <textarea
                                value={observacoesPagamento}
                                onChange={(e) => setObservacoesPagamento(e.target.value)}
                                rows="2"
                                style={inputStyle}
                            ></textarea>
                        </div>
                        <button type="submit" disabled={paymentLoading} style={submitButtonStyle}>
                            {paymentLoading ? 'Registrando...' : 'Confirmar Pagamento'}
                        </button>
                        <button type="button" onClick={() => setShowPaymentForm(false)} style={cancelButtonStyle}>
                            Cancelar
                        </button>
                    </form>
                </div>
            )}

            <button onClick={() => navigate('/carnes')} style={{ ...submitButtonStyle, marginTop: '20px', backgroundColor: '#6c757d' }}>
                Voltar para Lista de Carnês
            </button>
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


const carneDetailsContainerStyle = { maxWidth: '1000px', margin: '20px auto', padding: '20px', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
const detailsHeaderStyle = { textAlign: 'center', marginBottom: '20px' };
const carneInfoStyle = { marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: '#f9f9f9' };
const parcelasHeaderStyle = { marginTop: '30px', marginBottom: '15px' };
const paymentFormContainerStyle = { marginTop: '30px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#fff' };

const tableStyle = { width: '100%', borderCollapse: 'collapse', marginTop: '10px' };
const tableHeaderStyle = { borderBottom: '1px solid #ddd', padding: '10px', textAlign: 'left', backgroundColor: '#f2f2f2' };
const tableCellStyle = { borderBottom: '1px solid #eee', padding: '10px' };
const actionButtonStyle = { padding: '5px 8px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px', fontSize: '0.8em' };

const pagamentosSubTableContainerStyle = { margin: '15px 0', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '5px', backgroundColor: '#fafafa' };
const pagamentosSubTableHeaderStyle = { fontSize: '0.9em', marginBottom: '10px', color: '#555' };
const pagamentosSubTableStyle = { width: '100%', borderCollapse: 'collapse', margin: '0' };
const pagamentosSubTableHeaderCellStyle = { borderBottom: '1px solid #e0e0e0', padding: '8px', textAlign: 'left', backgroundColor: '#f9f9f9', fontSize: '0.85em' };
const pagamentosSubTableCellStyle = { borderBottom: '1px solid #f0f0f0', padding: '8px', fontSize: '0.8em' };


const formContainerStyle = { maxWidth: '600px', margin: '20px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
const formGroupStyle = { marginBottom: '15px' };
const labelStyle = { display: 'block', marginBottom: '5px', fontWeight: 'bold' };
const inputStyle = { width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ddd' };
const submitButtonStyle = { width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const cancelButtonStyle = { width: '100%', padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' };

export default CarneDetailsPage;