import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import ConfirmationModal from '../components/ConfirmationModal';
import LoadingSpinner from '../components/LoadingSpinner';

// Importações do Material-UI
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper'; // Para os cards de informação
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip'; // Para os badges de status
import Dialog from '@mui/material/Dialog'; // Para os modais
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';


const CarneDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

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


    const fetchCarneDetails = useCallback(async () => {
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
    }, [id, user, setGlobalAlert]); // Usando setGlobalAlert corretamente

    useEffect(() => {
        fetchCarneDetails();
    }, [fetchCarneDetails]);

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
                setGlobalAlert({ type: 'warning', message: 'Por favor, insira um valor de pagamento válido.' });
                return;
            }
            if (parsedPaymentValue > parcelaToPay.saldo_devedor) {
                setGlobalAlert({ type: 'warning', message: 'O valor do pagamento excede o saldo devedor da parcela.' });
                return;
            }

            await api.post(`/carnes/${carne.id_carne}/parcelas/${parcelaToPay.id_parcela}/pagar`, {
                valor_pago: parsedPaymentValue
            }, {
                headers: {
                    Authorization: `Bearer ${user.token}`
                }
            });
            setGlobalAlert({ type: 'success', message: 'Pagamento registrado com sucesso!' });
            setShowPaymentModal(false);
            fetchCarneDetails(); // Recarrega os detalhes do carnê para atualizar o status e saldos
        } catch (err) {
            console.error("Erro ao registrar pagamento:", err);
            setGlobalAlert({ type: 'error', message: err.response?.data?.detail || 'Erro ao registrar pagamento.' });
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
            setGlobalAlert({ type: 'success', message: 'Pagamento estornado com sucesso!' });
            setShowReversePaymentModal(false);
            fetchCarneDetails(); // Recarrega os detalhes do carnê para atualizar o status e saldos
        } catch (err) {
            console.error("Erro ao estornar pagamento:", err);
            setGlobalAlert({ type: 'error', message: err.response?.data?.detail || 'Erro ao estornar pagamento.' });
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
                setGlobalAlert({ type: 'warning', message: 'Por favor, insira a nova data de vencimento.' });
                return;
            }
            if (parsedNewValue !== null && (isNaN(parsedNewValue) || parsedNewValue <= 0)) {
                setGlobalAlert({ type: 'warning', message: 'Por favor, insira um novo valor válido (opcional).' });
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
            setGlobalAlert({ type: 'success', message: 'Parcela renegociada com sucesso!' });
            setShowRenegotiateModal(false);
            fetchCarneDetails(); // Recarrega os detalhes do carnê para atualizar
        } catch (err) {
            console.error("Erro ao renegociar parcela:", err);
            setGlobalAlert({ type: 'error', message: err.response?.data?.detail || 'Erro ao renegociar parcela.' });
        }
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return <Typography color="error" className="text-center p-4">{error}</Typography>;
    }

    if (!carne) {
        return <Typography color="info" className="text-center p-4">Carnê não encontrado.</Typography>;
    }

    // Função auxiliar para formatar moeda
    const formatCurrency = (value) => {
        return new Intl.NumberFomart('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    // Função auxiliar para determinar a cor do chip de status
    const getStatusChipColor = (status) => {
        switch (status.toLowerCase()) {
            case 'quitado': return 'success';
            case 'em atraso': return 'error';
            case 'cancelado': return 'default';
            case 'ativo': return 'primary';
            case 'pago': return 'success';
            case 'pendente': return 'warning';
            default: return 'info';
        }
    };

    return (
        <Container maxWidth="lg" className="py-8">
            <Typography variant="h4" component="h1" className="mb-6 text-center font-bold text-gray-800">
                Detalhes do Carnê: {carne.descricao}
            </Typography>

            <Paper elevation={3} className="p-6 mb-8 rounded-lg">
                <Typography variant="h6" component="h2" className="mb-4 font-semibold text-gray-700">Informações do Carnê</Typography>
                <Box className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-gray-700">
                    <Typography variant="body1"><strong>ID do Carnê:</strong> {carne.id_carne}</Typography>
                    <Typography variant="body1"><strong>Cliente:</strong> {carne.cliente.nome} ({carne.cliente.cpf_cnpj})</Typography>
                    <Typography variant="body1"><strong>Valor Total Original:</strong> {formatCurrency(carne.valor_total_original)}</Typography>
                    <Typography variant="body1"><strong>Número de Parcelas:</strong> {carne.numero_parcelas}</Typography>
                    {carne.data_venda && <Typography variant="body1"><strong>Data da Venda:</strong> {new Date(carne.data_venda).toLocaleDateString('pt-BR')}</Typography>}
                    {carne.valor_entrada !== null && <Typography variant="body1"><strong>Valor da Entrada:</strong> {formatCurrency(carne.valor_entrada)}</Typography>}
                    {carne.forma_pagamento_entrada && <Typography variant="body1"><strong>Forma de Pagamento da Entrada:</strong> {carne.forma_pagamento_entrada}</Typography>}
                    <Typography variant="body1">
                        <strong>Status do Carnê:</strong>
                        <Chip
                            label={carne.status_carne.toUpperCase()}
                            color={getStatusChipColor(carne.status_carne)}
                            className="ml-2"
                        />
                    </Typography>
                    <Typography variant="body1"><strong>Parcela Fixa:</strong> {carne.parcela_fixa ? 'Sim' : 'Não'}</Typography>
                </Box>
                <Box className="mt-6 flex flex-wrap gap-4 justify-end">
                    <Button
                        variant="contained"
                        color="warning"
                        component={Link}
                        to={`/carnes/edit/${carne.id_carne}`}
                        className="flex-grow sm:flex-grow-0"
                    >
                        Editar Carnê
                    </Button>
                    <Button
                        variant="outlined"
                        color="secondary"
                        component={Link}
                        to="/carnes"
                        className="flex-grow sm:flex-grow-0"
                    >
                        Voltar aos Carnês
                    </Button>
                </Box>
            </Paper>

            <Typography variant="h5" component="h2" className="mb-4 font-bold text-gray-800">Parcelas</Typography>
            <TableContainer component={Paper} elevation={3} className="mb-8 rounded-lg">
                <Table>
                    <TableHead className="bg-gray-200">
                        <TableRow>
                            <TableCell>#</TableCell>
                            <TableCell>Valor Devido</TableCell>
                            <TableCell>Juros/Multa</TableCell>
                            <TableCell>Saldo Devedor</TableCell>
                            <TableCell>Valor Pago</TableCell>
                            <TableCell>Vencimento</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Obs.</TableCell>
                            <TableCell>Ações</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {carne.parcelas.map(parcela => (
                            <TableRow key={parcela.id_parcela} className="hover:bg-gray-50">
                                <TableCell>{parcela.numero_parcela}</TableCell>
                                <TableCell>{formatCurrency(parcela.valor_devido)}</TableCell>
                                <TableCell>{formatCurrency(parcela.juros_multa)}</TableCell>
                                <TableCell>{formatCurrency(parcela.saldo_devedor)}</TableCell>
                                <TableCell>{formatCurrency(parcela.valor_pago)}</TableCell>
                                <TableCell>{new Date(parcela.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={parcela.status_parcela.toUpperCase()}
                                        color={getStatusChipColor(parcela.status_parcela)}
                                    />
                                </TableCell>
                                <TableCell>{parcela.observacoes || '-'}</TableCell>
                                <TableCell>
                                    <Box className="flex flex-wrap gap-2">
                                        {parcela.status_parcela !== 'pago' && (
                                            <Button
                                                variant="contained"
                                                color="success"
                                                size="small"
                                                onClick={() => handlePayClick(parcela)}
                                                disabled={!user || (user.perfil !== 'admin' && user.perfil !== 'atendente')}
                                            >
                                                Pagar
                                            </Button>
                                        )}
                                        {user.perfil === 'admin' && (
                                            <Button
                                                variant="contained"
                                                color="info"
                                                size="small"
                                                onClick={() => handleRenegotiateClick(parcela)}
                                            >
                                                Renegociar
                                            </Button>
                                        )}
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Typography variant="h5" component="h2" className="mb-4 font-bold text-gray-800">Histórico de Pagamentos</Typography>
            {carne.pagamentos && carne.pagamentos.length > 0 ? (
                <TableContainer component={Paper} elevation={3} className="mb-8 rounded-lg">
                    <Table size="small"> {/* Tabela menor para histórico */}
                        <TableHead className="bg-gray-100">
                            <TableRow>
                                <TableCell>ID Pagamento</TableCell>
                                <TableCell>Parcela Ref.</TableCell>
                                <TableCell>Valor Pago</TableCell>
                                <TableCell>Data Pagamento</TableCell>
                                <TableCell>Usuário</TableCell>
                                <TableCell>Ações</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {carne.pagamentos.map(pagamento => (
                                <TableRow key={pagamento.id_pagamento} className="hover:bg-gray-50">
                                    <TableCell>{pagamento.id_pagamento}</TableCell>
                                    <TableCell>{pagamento.numero_parcela}</TableCell>
                                    <TableCell>{formatCurrency(pagamento.valor_pago)}</TableCell>
                                    <TableCell>{new Date(pagamento.data_pagamento).toLocaleDateString('pt-BR')}</TableCell>
                                    <TableCell>{pagamento.usuario_registro_nome || 'N/A'}</TableCell>
                                    <TableCell>
                                        {user.perfil === 'admin' && (
                                            <Button
                                                variant="contained"
                                                color="error"
                                                size="small"
                                                onClick={() => handleReversePaymentClick(
                                                    carne.parcelas.find(p => p.id_parcela === pagamento.id_parcela),
                                                    pagamento
                                                )}
                                            >
                                                Estornar
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : (
                <Typography className="text-center text-gray-600">Nenhum pagamento registrado para este carnê.</Typography>
            )}

            {/* Modal de Pagamento (usando Dialog do MUI) */}
            <Dialog open={showPaymentModal} onClose={() => setShowPaymentModal(false)}>
                <DialogTitle>Registrar Pagamento</DialogTitle>
                <DialogContent>
                    <Typography className="mb-2">Deseja registrar o pagamento para a parcela {parcelaToPay?.numero_parcela}?</Typography>
                    <Typography className="mb-4">Valor Devido: <strong>{formatCurrency(parcelaToPay?.saldo_devedor || 0)}</strong></Typography>
                    <TextField
                        autoFocus
                        margin="dense"
                        id="paymentValue"
                        label="Valor a Pagar"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={paymentValue}
                        onChange={(e) => setPaymentValue(e.target.value)}
                        inputProps={{ step: "0.01", min: "0.01", max: parcelaToPay?.saldo_devedor.toFixed(2) }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowPaymentModal(false)} variant="outlined">
                        Cancelar
                    </Button>
                    <Button onClick={handlePaymentSubmit} variant="contained" color="success">
                        Confirmar Pagamento
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Modal de Estorno de Pagamento (usando Dialog do MUI) */}
            <Dialog open={showReversePaymentModal} onClose={() => setShowReversePaymentModal(false)}>
                <DialogTitle>Estornar Pagamento</DialogTitle>
                <DialogContent>
                    <Typography className="mb-2">Tem certeza que deseja estornar o pagamento de <strong>{formatCurrency(paymentToReverse?.valor_pago || 0)}</strong> para a parcela {parcelaToReverse?.numero_parcela}?</Typography>
                    <Typography color="error" className="font-bold">Esta ação não pode ser desfeita.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowReversePaymentModal(false)} variant="outlined">
                        Cancelar
                    </Button>
                    <Button onClick={handleReversePaymentConfirm} variant="contained" color="error">
                        Sim, Estornar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Modal de Renegociação (usando Dialog do MUI) */}
            <Dialog open={showRenegotiateModal} onClose={() => setShowRenegotiateModal(false)}>
                <DialogTitle>Renegociar Parcela</DialogTitle>
                <DialogContent>
                    <Typography className="mb-2">Renegociar a parcela {parcelaToRenegotiate?.numero_parcela}:</Typography>
                    <TextField
                        margin="dense"
                        id="newDueDate"
                        label="Nova Data de Vencimento"
                        type="date"
                        fullWidth
                        variant="outlined"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        className="mb-4"
                    />
                    <TextField
                        margin="dense"
                        id="newRenegotiatedValue"
                        label="Novo Valor (opcional)"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={newRenegotiatedValue}
                        onChange={(e) => setNewRenegotiatedValue(e.target.value)}
                        inputProps={{ step: "0.01", min: "0" }}
                        helperText="Deixe em branco para manter o valor original com juros/multa aplicados até a nova data de vencimento."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowRenegotiateModal(false)} variant="outlined">
                        Cancelar
                    </Button>
                    <Button onClick={handleRenegotiateSubmit} variant="contained" color="primary">
                        Confirmar Renegociação
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default CarneDetailsPage;