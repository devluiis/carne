import React, { useState, useEffect, useCallback } from 'react';
import { carnes, clients } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

// Importações do Material-UI
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import FormHelperText from '@mui/material/FormHelperText'; // Para mensagens de ajuda

function CarneForm() {
    const [idCliente, setIdCliente] = useState('');
    const [dataVenda, setDataVenda] = useState('');
    const [descricao, setDescricao] = useState('');
    const [valorTotalOriginal, setValorTotalOriginal] = useState('');
    const [numeroParcelas, setNumeroParcelas] = useState('');
    const [valorParcelaSugerido, setValorParcelaSugerido] = useState('');
    const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState('');
    const [frequenciaPagamento, setFrequenciaPagamento] = useState('mensal');
    const [statusCarne, setStatusCarne] = useState('Ativo');
    const [observacoes, setObservacoes] = useState('');
    const [valorEntrada, setValorEntrada] = useState('');
    const [formaPagamentoEntrada, setFormaPagamentoEntrada] = useState('');
    const [parcelaFixa, setParcelaFixa] = useState(true); // Estado para o checkbox

    const [clientOptions, setClientOptions] = useState([]);
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [hasPayments, setHasPayments] = useState(false);
    const [editWarningMessage, setEditWarningMessage] = useState('');

    const navigate = useNavigate();
    const { id, clientIdFromUrl } = useParams();
    const { setGlobalAlert } = useGlobalAlert();

    const fetchCarneParaEdicao = useCallback(async (carneId) => {
        try {
            const response = await carnes.getById(carneId);
            const carne = response.data;
            setIdCliente(String(carne.id_cliente)); // Converte para string para o select
            setDataVenda(carne.data_venda ? new Date(carne.data_venda + 'T00:00:00').toISOString().split('T')[0] : '');
            setDescricao(carne.descricao || '');
            setValorTotalOriginal(String(carne.valor_total_original));
            setNumeroParcelas(String(carne.numero_parcelas));
            setValorParcelaSugerido(String(carne.valor_parcela_original)); // Usar valor_parcela_original como sugerido para edição
            setDataPrimeiroVencimento(carne.data_primeiro_vencimento ? new Date(carne.data_primeiro_vencimento + 'T00:00:00').toISOString().split('T')[0] : '');
            setFrequenciaPagamento(carne.frequencia_pagamento);
            setStatusCarne(carne.status_carne);
            setObservacoes(carne.observacoes || '');
            setValorEntrada(String(carne.valor_entrada || 0));
            setFormaPagamentoEntrada(carne.forma_pagamento_entrada || '');
            setParcelaFixa(carne.parcela_fixa);

            const anyPayments = carne.parcelas?.some(p => p.pagamentos?.length > 0 || parseFloat(p.valor_pago) > 0);
            setHasPayments(anyPayments);
            if (anyPayments) {
                setEditWarningMessage('Este carnê possui pagamentos. Apenas Descrição, Data da Venda, Status e Observações podem ser alterados. Campos financeiros e o tipo de parcelamento serão desabilitados.');
            }
        } catch (err) {
            console.error('Erro ao carregar carnê para edição:', err);
            setGlobalAlert({ message: 'Erro ao carregar dados do carnê para edição.', type: 'error' });
        }
    }, [setGlobalAlert]);

    useEffect(() => {
        setLoadingInitial(true);
        clients.getAll()
            .then(response => {
                setClientOptions(response.data || []);
                if (clientIdFromUrl && !id) {
                    setIdCliente(clientIdFromUrl);
                }
            })
            .catch(err => {
                console.error("Erro ao carregar clientes:", err);
                setGlobalAlert({ message: 'Falha ao carregar clientes.', type: 'error' });
            })
            .finally(() => {
                if (id) {
                    fetchCarneParaEdicao(id).finally(() => setLoadingInitial(false));
                } else {
                    setDataVenda(new Date().toISOString().split('T')[0]); // Preenche data da venda automaticamente para novos carnês
                    setLoadingInitial(false);
                }
            });
    }, [id, clientIdFromUrl, fetchCarneParaEdicao, setGlobalAlert]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);

        const vTotal = parseFloat(valorTotalOriginal);
        const vEntrada = parseFloat(valorEntrada) || 0;
        let nParcelas = parcelaFixa ? parseInt(numeroParcelas) : 1; // Se não for parcela fixa, sempre 1 parcela
        const vParcelaSugerido = parseFloat(valorParcelaSugerido);

        // Validações
        if (!idCliente) {
            setGlobalAlert({ message: 'Selecione um cliente.', type: 'warning' });
            setSubmitLoading(false); return;
        }
        if (!dataVenda) {
            setGlobalAlert({ message: 'Data da venda é obrigatória.', type: 'warning' });
            setSubmitLoading(false); return;
        }
        if (isNaN(vTotal) || vTotal <= 0) {
            setGlobalAlert({ message: 'Valor total original deve ser um número positivo.', type: 'warning' });
            setSubmitLoading(false); return;
        }
        if (isNaN(vEntrada) || vEntrada < 0) {
            setGlobalAlert({ message: 'Valor de entrada deve ser um número positivo ou zero.', type: 'warning' });
            setSubmitLoading(false); return;
        }
        if (vEntrada > vTotal) {
            setGlobalAlert({ message: 'Valor de entrada não pode ser maior que o valor total.', type: 'warning' });
            setSubmitLoading(false); return;
        }
        if (parcelaFixa && (isNaN(nParcelas) || nParcelas <= 0)) { // Validação de parcelas apenas para carnê fixo
            setGlobalAlert({ message: 'Número de parcelas deve ser um inteiro positivo para carnê fixo.', type: 'warning' });
            setSubmitLoading(false); return;
        }
        if (!dataPrimeiroVencimento) {
            setGlobalAlert({ message: 'Data do primeiro vencimento é obrigatória.', type: 'warning' });
            setSubmitLoading(false); return;
        }
        if (new Date(dataPrimeiroVencimento) < new Date(dataVenda)) {
            setGlobalAlert({ message: 'A data do primeiro vencimento não pode ser anterior à data da venda.', type: 'warning' });
            setSubmitLoading(false); return;
        }
        if (vEntrada > 0 && !formaPagamentoEntrada) {
            setGlobalAlert({ message: 'Forma de pagamento da entrada é obrigatória se houver valor de entrada.', type: 'warning' });
            setSubmitLoading(false); return;
        }

        const carneData = {
            id_cliente: parseInt(idCliente),
            data_venda: dataVenda,
            descricao,
            valor_total_original: vTotal,
            numero_parcelas: nParcelas,
            // Passa valorParcelaSugerido apenas se for carnê fixo e o campo foi preenchido
            valor_parcela_sugerido: parcelaFixa && valorParcelaSugerido !== '' ? vParcelaSugerido : null,
            data_primeiro_vencimento: dataPrimeiroVencimento,
            frequencia_pagamento: parcelaFixa ? frequenciaPagamento : "única", // 'única' para flexível
            status_carne: statusCarne,
            observacoes,
            valor_entrada: vEntrada,
            forma_pagamento_entrada: vEntrada > 0 ? formaPagamentoEntrada : null,
            parcela_fixa: parcelaFixa // Envia o tipo de carnê
        };

        try {
            if (id) {
                await carnes.update(id, carneData);
                setGlobalAlert({ message: 'Carnê atualizado com sucesso!', type: 'success' });
                navigate(`/carnes/details/${id}`);
            } else {
                const response = await carnes.create(carneData);
                setGlobalAlert({ message: 'Carnê cadastrado com sucesso!', type: 'success' });
                const newCarneId = response.data.id_carne;
                if (newCarneId) {
                    navigate(`/carnes/details/${newCarneId}`);
                } else {
                    navigate('/carnes');
                }
            }
        } catch (err) {
            const errorDetail = err.response?.data?.detail || err.message || "Erro desconhecido";
            setGlobalAlert({ message: `Erro ao salvar carnê: ${errorDetail}`, type: 'error' });
        } finally {
            setSubmitLoading(false);
        }
    };

    const isFinancialFieldDisabled = id && hasPayments;

    if (loadingInitial) {
        return <LoadingSpinner message="Carregando dados do formulário..." />;
    }

    return (
        <Container component="main" maxWidth="md" className="flex items-center justify-center min-h-screen py-8">
            <Box
                sx={{
                    p: 4, // padding-4
                    borderRadius: 2, // rounded-lg
                    boxShadow: 3, // shadow-md
                    bgcolor: 'background.paper', // bg-white
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
                className="w-full max-w-2xl mx-auto" // Tailwind classes
            >
                <Typography component="h1" variant="h5" className="mb-6 font-bold text-gray-800">
                    {id ? 'Editar Carnê' : 'Cadastrar Novo Carnê'}
                </Typography>
                {editWarningMessage && (
                    <Typography color="warning" className="mb-4 text-center font-bold">
                        {editWarningMessage}
                    </Typography>
                )}

                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }} className="w-full">
                    <FormControl fullWidth margin="normal" className="mb-4">
                        <InputLabel id="idCliente-label">Cliente *</InputLabel>
                        <Select
                            labelId="idCliente-label"
                            id="idCliente"
                            value={idCliente}
                            label="Cliente *"
                            onChange={(e) => setIdCliente(e.target.value)}
                            required
                            disabled={isFinancialFieldDisabled || !!clientIdFromUrl || Boolean(id)}
                        >
                            <MenuItem value="">
                                <em>Selecione um Cliente</em>
                            </MenuItem>
                            {clientOptions.map(client => (
                                <MenuItem key={client.id_cliente} value={client.id_cliente}>
                                    {client.nome} ({client.cpf_cnpj})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="dataVenda"
                        label="Data da Venda/Emissão do Carnê *"
                        name="dataVenda"
                        type="date"
                        value={dataVenda}
                        onChange={(e) => setDataVenda(e.target.value)}
                        InputLabelProps={{ shrink: true }} // Para garantir que o label não se sobreponha à data
                        disabled={isFinancialFieldDisabled}
                        className="mb-4"
                    />

                    <TextField
                        margin="normal"
                        fullWidth
                        id="descricaoCarne"
                        label="Descrição (Opcional)"
                        name="descricao"
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        className="mb-4"
                    />

                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="valorTotalOriginal"
                        label="Valor Total Original da Dívida *"
                        name="valorTotalOriginal"
                        type="number"
                        step="0.01"
                        value={valorTotalOriginal}
                        onChange={(e) => setValorTotalOriginal(e.target.value)}
                        disabled={isFinancialFieldDisabled}
                        className="mb-4"
                    />

                    <TextField
                        margin="normal"
                        fullWidth
                        id="valorEntrada"
                        label="Valor de Entrada (Opcional)"
                        name="valorEntrada"
                        type="number"
                        step="0.01"
                        value={valorEntrada}
                        onChange={(e) => setValorEntrada(e.target.value)}
                        inputProps={{ min: "0" }}
                        disabled={isFinancialFieldDisabled}
                        className="mb-4"
                    />

                    {parseFloat(valorEntrada) > 0 && (
                        <FormControl fullWidth margin="normal" className="mb-4">
                            <InputLabel id="formaPagamentoEntrada-label">Forma de Pagamento da Entrada *</InputLabel>
                            <Select
                                labelId="formaPagamentoEntrada-label"
                                id="formaPagamentoEntrada"
                                value={formaPagamentoEntrada}
                                label="Forma de Pagamento da Entrada *"
                                onChange={(e) => setFormaPagamentoEntrada(e.target.value)}
                                required={parseFloat(valorEntrada) > 0}
                                disabled={isFinancialFieldDisabled}
                            >
                                <MenuItem value="">Selecione...</MenuItem>
                                <MenuItem value="Dinheiro">Dinheiro</MenuItem>
                                <MenuItem value="PIX">PIX</MenuItem>
                                <MenuItem value="Cartão de Crédito">Cartão de Crédito</MenuItem>
                                <MenuItem value="Débito">Débito</MenuItem>
                            </Select>
                        </FormControl>
                    )}

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={parcelaFixa}
                                onChange={(e) => setParcelaFixa(e.target.checked)}
                                disabled={isFinancialFieldDisabled}
                            />
                        }
                        label="Carnê com parcelas de valor fixo?"
                        className="mb-2"
                    />
                    <FormHelperText className="mb-4 -mt-2 ml-8">
                        Desmarque para permitir pagamentos flexíveis em uma única parcela com saldo variável.
                    </FormHelperText>

                    {parcelaFixa ? (
                        <>
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                id="numeroParcelas"
                                label="Número de Parcelas *"
                                name="numeroParcelas"
                                type="number"
                                value={numeroParcelas}
                                onChange={(e) => setNumeroParcelas(e.target.value)}
                                inputProps={{ min: "1" }}
                                disabled={isFinancialFieldDisabled}
                                className="mb-4"
                            />

                            <TextField
                                margin="normal"
                                fullWidth
                                id="valorParcelaSugerido"
                                label="Valor Sugerido por Parcela (Opcional)"
                                name="valorParcelaSugerido"
                                type="number"
                                step="0.01"
                                value={valorParcelaSugerido}
                                onChange={(e) => setValorParcelaSugerido(e.target.value)}
                                inputProps={{ min: "0.01" }}
                                disabled={isFinancialFieldDisabled}
                                helperText="Se preenchido, a última parcela será ajustada para fechar o valor total."
                                className="mb-4"
                            />

                            <FormControl fullWidth margin="normal" className="mb-4">
                                <InputLabel id="frequenciaPagamento-label">Frequência de Pagamento *</InputLabel>
                                <Select
                                    labelId="frequenciaPagamento-label"
                                    id="frequenciaPagamento"
                                    value={frequenciaPagamento}
                                    label="Frequência de Pagamento *"
                                    onChange={(e) => setFrequenciaPagamento(e.target.value)}
                                    required
                                    disabled={isFinancialFieldDisabled}
                                >
                                    <MenuItem value="mensal">Mensal</MenuItem>
                                    <MenuItem value="quinzenal">Quinzenal</MenuItem>
                                    <MenuItem value="trimestral">Trimestral</MenuItem>
                                </Select>
                            </FormControl>
                        </>
                    ) : (
                        <>
                            <TextField
                                margin="normal"
                                fullWidth
                                id="numeroParcelas"
                                label="Número de Parcelas"
                                name="numeroParcelas"
                                value="1"
                                disabled
                                helperText="Carnês flexíveis são tratados como 1 parcela para o saldo total."
                                className="mb-4"
                            />
                            <TextField
                                margin="normal"
                                fullWidth
                                id="frequenciaPagamento"
                                label="Frequência de Pagamento"
                                name="frequenciaPagamento"
                                value="Única / Variável"
                                disabled
                                helperText="Pagamentos podem ser feitos a qualquer momento para abater o saldo."
                                className="mb-4"
                            />
                        </>
                    )}

                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="dataPrimeiroVencimento"
                        label="Data do Primeiro Vencimento *"
                        name="dataPrimeiroVencimento"
                        type="date"
                        value={dataPrimeiroVencimento}
                        onChange={(e) => setDataPrimeiroVencimento(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        disabled={isFinancialFieldDisabled}
                        className="mb-4"
                    />

                    <FormControl fullWidth margin="normal" className="mb-4">
                        <InputLabel id="statusCarne-label">Status do Carnê *</InputLabel>
                        <Select
                            labelId="statusCarne-label"
                            id="statusCarne"
                            value={statusCarne}
                            label="Status do Carnê *"
                            onChange={(e) => setStatusCarne(e.target.value)}
                            required
                        >
                            <MenuItem value="Ativo">Ativo</MenuItem>
                            <MenuItem value="Cancelado">Cancelado</MenuItem>
                        </Select>
                    </FormControl>

                    <TextField
                        margin="normal"
                        fullWidth
                        id="observacoesCarne"
                        label="Observações (Opcional)"
                        name="observacoes"
                        multiline
                        rows={3}
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        className="mb-6"
                    />

                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }} className="w-full flex-col sm:flex-row">
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={submitLoading}
                            className="py-3 text-lg font-semibold flex-grow sm:flex-grow-0"
                        >
                            {submitLoading ? <CircularProgress size={24} color="inherit" /> : (id ? 'Atualizar Carnê' : 'Cadastrar Carnê')}
                        </Button>
                        <Button
                            type="button"
                            variant="outlined"
                            onClick={() => navigate('/carnes')}
                            className="py-3 text-lg font-semibold flex-grow sm:flex-grow-0"
                        >
                            Cancelar
                        </Button>
                    </Box>
                </Box>
            </Box>
        </Container>
    );
}

export default CarneForm;