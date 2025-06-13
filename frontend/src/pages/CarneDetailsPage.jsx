import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx'; // Correct import and usage
import ConfirmationModal from '../components/ConfirmationModal';
import LoadingSpinner from '../components/LoadingSpinner';

// Importações do Material-UI para novos componentes (opcional, pode ser feito depois de testar a correção)
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';


const CarneDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert(); // Correctly destructuring setGlobalAlert

    const [carne, setCarne] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [parcelaToPay, setParcelaToPay] = useState(null);
    const [paymentValue, setPaymentValue] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showReversePaymentModal, setShowReversePaymentModal] = useState(false);
    const [parcelaToReverse, setParcelaToReverse] = useState(null);
    const [paymentToReverse, setPaymentToReverse] = useState(null);
    const [showRenegotiateModal, setShowRenegotiateModal] = useState(false);
    const [parcelaToRenegotiate, setParcelaToRenegotiate] = useState(null);
    const [newDueDate, setNewDueDate] = useState('');
    const [newRenegotiatedValue, setNewRenegotiatedValue] = useState('');


    useEffect(() => {
        const fetchCarneDetails = async () => {
            if (!user) {
                setError("Usuário não autenticado.");
                setLoading(false);
                return;
            }
            try {
                const response = await api.get(`/carnes/${id}`, {
                    headers: {
                        Authorization: `Bearer ${user.token}`
                    }
                });
                setCarne(response.data);
            } catch (err) {
                console.error("Erro ao buscar detalhes do carnê:", err);
                setError(err.response?.data?.detail || "Erro ao carregar detalhes do carnê.");
            } finally {
                setLoading(false);
            }
        };

        fetchCarneDetails();
    }, [id, user, setGlobalAlert]); // Changed setAlert to setGlobalAlert here

    const handlePayClick = (parcela) => {
        setParcelaToPay(parcela);
        setPaymentValue(parcela.saldo_devedor.toFixed(2));
        setShowPaymentModal(true);
    };

    const handlePaymentSubmit = async () => {
        if (!user || !parcelaToPay) return;
        try {
            const parsedPaymentValue = parseFloat(paymentValue);
            if (isNaN(parsedPaymentValue) || parsedPaymentValue <= 0) {
                setGlobalAlert({ type: 'warning', message: 'Por favor, insira um valor de pagamento válido.' }); // Changed setAlert
                return;
            }
            if (parsedPaymentValue > parcelaToPay.saldo_devedor) {
                setGlobalAlert({ type: 'warning', message: 'O valor do pagamento excede o saldo devedor da parcela.' }); // Changed setAlert
                return;
            }

            await api.post(`/carnes/${carne.id_carne}/parcelas/${parcelaToPay.id_parcela}/pagar`, {
                valor_pago: parsedPaymentValue
            }, {
                headers: {
                    Authorization: `Bearer ${user.token}`
                }
            });
            setGlobalAlert({ type: 'success', message: 'Pagamento registrado com sucesso!' }); // Changed setAlert
            setShowPaymentModal(false);
            // Recarrega os detalhes do carnê para atualizar o status e saldos
            const response = await api.get(`/carnes/${id}`, {
                headers: {
                    Authorization: `Bearer ${user.token}`
                }
            });
            setCarne(response.data);
        } catch (err) {
            console.error("Erro ao registrar pagamento:", err);
            setGlobalAlert({ type: 'error', message: err.response?.data?.detail || 'Erro ao registrar pagamento.' }); // Changed setAlert
        }
    };

    const handleReversePaymentClick = (parcela, pagamento) => {
        setParcelaToReverse(parcela);
        setPaymentToReverse(pagamento);
        setShowReversePaymentModal(true);
    };

    const handleReversePaymentConfirm = async () => {
        if (!user || !parcelaToReverse || !paymentToReverse) return;
        try {
            await api.post(`/carnes/${carne.id_carne}/parcelas/${parcelaToReverse.id_parcela}/reverse-payment`, {
                pagamento_id: paymentToReverse.id_pagamento
            }, {
                headers: {
                    Authorization: `Bearer ${user.token}`
                }
            });
            setGlobalAlert({ type: 'success', message: 'Pagamento estornado com sucesso!' }); // Changed setAlert
            setShowReversePaymentModal(false);
            // Recarrega os detalhes do carnê para atualizar o status e saldos
            const response = await api.get(`/carnes/${id}`, {
                headers: {
                    Authorization: `Bearer ${user.token}`
                }
            });
            setCarne(response.data);
        } catch (err) {
            console.error("Erro ao estornar pagamento:", err);
            setGlobalAlert({ type: 'error', message: err.response?.data?.detail || 'Erro ao estornar pagamento.' }); // Changed setAlert
        }
    };

    const handleRenegotiateClick = (parcela) => {
        setParcelaToRenegotiate(parcela);
        setNewDueDate(parcela.data_vencimento.split('T')[0]); // Define a data de vencimento atual como padrão
        setNewRenegotiatedValue(parcela.valor_devido.toFixed(2)); // Define o valor atual como padrão
        setShowRenegotiateModal(true);
    };

    const handleRenegotiateSubmit = async () => {
        if (!user || !parcelaToRenegotiate) return;
        try {
            const parsedNewValue = newRenegotiatedValue ? parseFloat(newRenegotiatedValue) : null;
            if (newDueDate === '') {
                setGlobalAlert({ type: 'warning', message: 'Por favor, insira a nova data de vencimento.' }); // Changed setAlert
                return;
            }
            if (parsedNewValue !== null && (isNaN(parsedNewValue) || parsedNewValue <= 0)) {
                setGlobalAlert({ type: 'warning', message: 'Por favor, insira um novo valor válido (opcional).' }); // Changed setAlert
                return;
            }

            await api.post(`/carnes/${carne.id_carne}/parcelas/${parcelaToRenegotiate.id_parcela}/renegotiate`, null, {
                params: {
                    new_due_date: newDueDate,
                    new_value: parsedNewValue
                },
                headers: {
                    Authorization: `Bearer ${user.token}`
                }
            });
            setGlobalAlert({ type: 'success', message: 'Parcela renegociada com sucesso!' }); // Changed setAlert
            setShowRenegotiateModal(false);
            // Recarrega os detalhes do carnê para atualizar
            const response = await api.get(`/carnes/${id}`, {
                headers: {
                    Authorization: `Bearer ${user.token}`
                }
            });
            setCarne(response.data);
        } catch (err) {
            console.error("Erro ao renegociar parcela:", err);
            setGlobalAlert({ type: 'error', message: err.response?.data?.detail || 'Erro ao renegociar parcela.' }); // Changed setAlert
        }
    };

    // A função handleGeneratePdf foi removida

    if (loading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return <div className="alert alert-danger">{error}</div>;
    }

    if (!carne) {
        return <div className="alert alert-info">Carnê não encontrado.</div>;
    }

    // Função auxiliar para formatar moeda
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    return (
        <div className="container mt-4">
            <h2 className="mb-4">Detalhes do Carnê: {carne.descricao}</h2>
            <div className="card mb-3">
                <div className="card-body">
                    <p><strong>ID do Carnê:</strong> {carne.id_carne}</p>
                    <p><strong>Cliente:</strong> {carne.cliente.nome} ({carne.cliente.cpf_cnpj})</p>
                    <p><strong>Valor Total Original:</strong> {formatCurrency(carne.valor_total_original)}</p>
                    <p><strong>Número de Parcelas:</strong> {carne.numero_parcelas}</p>
                    {carne.data_venda && <p><strong>Data da Venda:</strong> {new Date(carne.data_venda).toLocaleDateString('pt-BR')}</p>}
                    {carne.valor_entrada !== null && <p><strong>Valor da Entrada:</strong> {formatCurrency(carne.valor_entrada)}</p>}
                    {carne.forma_pagamento_entrada && <p><strong>Forma de Pagamento da Entrada:</strong> {carne.forma_pagamento_entrada}</p>}
                    <p><strong>Status do Carnê:</strong> <span className={`badge bg-${carne.status_carne === 'quitado' ? 'success' : 'warning'}`}>{carne.status_carne.toUpperCase()}</span></p>
                    <p><strong>Parcela Fixa:</strong> {carne.parcela_fixa ? 'Sim' : 'Não'}</p>
                    <Link to={`/carnes/edit/${carne.id_carne}`} className="btn btn-warning me-2">Editar Carnê</Link>
                    {/* Botão de gerar PDF removido */}
                    <Link to="/carnes" className="btn btn-secondary">Voltar aos Carnês</Link>
                </div>
            </div>

            <h3 className="mb-3">Parcelas</h3>
            <div className="table-responsive">
                <table className="table table-striped table-hover">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Valor Devido</th>
                            <th>Juros/Multa</th>
                            <th>Saldo Devedor</th>
                            <th>Valor Pago</th>
                            <th>Vencimento</th>
                            <th>Status</th>
                            <th>Obs.</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {carne.parcelas.map(parcela => (
                            <tr key={parcela.id_parcela}>
                                <td>{parcela.numero_parcela}</td>
                                <td>{formatCurrency(parcela.valor_devido)}</td>
                                <td>{formatCurrency(parcela.juros_multa)}</td>
                                <td>{formatCurrency(parcela.saldo_devedor)}</td>
                                <td>{formatCurrency(parcela.valor_pago)}</td>
                                <td>{new Date(parcela.data_vencimento).toLocaleDateString('pt-BR')}</td>
                                <td>
                                    <span className={`badge bg-${parcela.status_parcela === 'pago' ? 'success' :
                                                            parcela.status_parcela === 'pendente' ? 'warning' :
                                                            'danger'}`}>
                                        {parcela.status_parcela.toUpperCase()}
                                    </span>
                                </td>
                                <td>{parcela.observacoes || '-'}</td>
                                <td>
                                    {parcela.status_parcela !== 'pago' && (
                                        <button
                                            className="btn btn-sm btn-success me-2"
                                            onClick={() => handlePayClick(parcela)}
                                            disabled={!user || (user.perfil !== 'admin' && user.perfil !== 'atendente')}
                                        >
                                            Pagar
                                        </button>
                                    )}
                                    {user.perfil === 'admin' && (
                                        <button
                                            className="btn btn-sm btn-info me-2"
                                            onClick={() => handleRenegotiateClick(parcela)}
                                        >
                                            Renegociar
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <h3 className="mb-3 mt-4">Histórico de Pagamentos</h3>
            {carne.pagamentos && carne.pagamentos.length > 0 ? (
                <div className="table-responsive">
                    <table className="table table-bordered table-sm">
                        <thead>
                            <tr>
                                <th>ID Pagamento</th>
                                <th>Parcela Ref.</th>
                                <th>Valor Pago</th>
                                <th>Data Pagamento</th>
                                <th>Usuário</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {carne.pagamentos.map(pagamento => (
                                <tr key={pagamento.id_pagamento}>
                                    <td>{pagamento.id_pagamento}</td>
                                    <td>{pagamento.numero_parcela}</td>
                                    <td>{formatCurrency(pagamento.valor_pago)}</td>
                                    <td>{new Date(pagamento.data_pagamento).toLocaleDateString('pt-BR')}</td>
                                    <td>{pagamento.usuario_registro_nome || 'N/A'}</td> {/* Added user info */}
                                    <td>
                                        {user.perfil === 'admin' && (
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleReversePaymentClick(
                                                    carne.parcelas.find(p => p.id_parcela === pagamento.id_parcela),
                                                    pagamento
                                                )}
                                            >
                                                Estornar
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p>Nenhum pagamento registrado para este carnê.</p>
            )}

            {/* Modal de Pagamento */}
            <ConfirmationModal
                isOpen={showPaymentModal}
                title="Registrar Pagamento"
                message={
                    <div>
                        <p>Deseja registrar o pagamento para a parcela {parcelaToPay?.numero_parcela}?</p>
                        <p>Valor Devido: <strong>{formatCurrency(parcelaToPay?.saldo_devedor || 0)}</strong></p>
                        <div className="mb-3">
                            <label htmlFor="paymentValue" className="form-label">Valor a Pagar:</label>
                            <input
                                type="number"
                                className="form-control"
                                id="paymentValue"
                                value={paymentValue}
                                onChange={(e) => setPaymentValue(e.target.value)}
                                step="0.01"
                                min="0.01"
                                max={parcelaToPay?.saldo_devedor.toFixed(2)}
                            />
                        </div>
                    </div>
                }
                onConfirm={handlePaymentSubmit}
                onCancel={() => setShowPaymentModal(false)}
                confirmText="Confirmar Pagamento"
                cancelText="Cancelar"
            />

            {/* Modal de Estorno de Pagamento */}
            <ConfirmationModal
                isOpen={showReversePaymentModal}
                title="Estornar Pagamento"
                message={
                    <div>
                        <p>Tem certeza que deseja estornar o pagamento de <strong>{formatCurrency(paymentToReverse?.valor_pago || 0)}</strong> para a parcela {parcelaToReverse?.numero_parcela}?</p>
                        <p className="text-danger">Esta ação não pode ser desfeita.</p>
                    </div>
                }
                onConfirm={handleReversePaymentConfirm}
                onCancel={() => setShowReversePaymentModal(false)}
                confirmText="Sim, Estornar"
                cancelText="Cancelar"
            />

            {/* Modal de Renegociação */}
            <ConfirmationModal
                isOpen={showRenegotiateModal}
                title="Renegociar Parcela"
                message={
                    <div>
                        <p>Renegociar a parcela {parcelaToRenegotiate?.numero_parcela}:</p>
                        <div className="mb-3">
                            <label htmlFor="newDueDate" className="form-label">Nova Data de Vencimento:</label>
                            <input
                                type="date"
                                className="form-control"
                                id="newDueDate"
                                value={newDueDate}
                                onChange={(e) => setNewDueDate(e.target.value)}
                            />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="newRenegotiatedValue" className="form-label">Novo Valor (opcional):</label>
                            <input
                                type="number"
                                className="form-control"
                                id="newRenegotiatedValue"
                                value={newRenegotiatedValue}
                                onChange={(e) => setNewRenegotiatedValue(e.target.value)}
                                step="0.01"
                                min="0"
                            />
                            <small className="form-text text-muted">Deixe em branco para manter o valor original com juros/multa aplicados até a nova data de vencimento.</small>
                        </div>
                    </div>
                }
                onConfirm={handleRenegotiateSubmit}
                onCancel={() => setShowRenegotiateModal(false)}
                confirmText="Confirmar Renegociação"
                cancelText="Cancelar"
            />
        </div>
    );
};

export default CarneDetailsPage;