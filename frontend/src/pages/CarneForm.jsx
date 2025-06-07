import React, { useState, useEffect, useCallback } from 'react';
import { carnes, clients } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

function CarneForm() {
    const [idCliente, setIdCliente] = useState('');
    const [dataVenda, setDataVenda] = useState('');
    const [descricao, setDescricao] = useState('');
    const [valorTotalOriginal, setValorTotalOriginal] = useState('');
    const [numeroParcelas, setNumeroParcelas] = useState('');
    const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState('');
    const [frequenciaPagamento, setFrequenciaPagamento] = useState('mensal');
    const [statusCarne, setStatusCarne] = useState('Ativo');
    const [observacoes, setObservacoes] = useState('');
    const [valorEntrada, setValorEntrada] = useState('');
    const [formaPagamentoEntrada, setFormaPagamentoEntrada] = useState('');

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
            setIdCliente(carne.id_cliente);
            setDataVenda(carne.data_venda ? new Date(carne.data_venda + 'T00:00:00').toISOString().split('T')[0] : '');
            setDescricao(carne.descricao || '');
            setValorTotalOriginal(String(carne.valor_total_original));
            setNumeroParcelas(String(carne.numero_parcelas));
            setDataPrimeiroVencimento(carne.data_primeiro_vencimento ? new Date(carne.data_primeiro_vencimento + 'T00:00:00').toISOString().split('T')[0] : '');
            setFrequenciaPagamento(carne.frequencia_pagamento);
            setStatusCarne(carne.status_carne);
            setObservacoes(carne.observacoes || '');
            setValorEntrada(String(carne.valor_entrada || 0));
            setFormaPagamentoEntrada(carne.forma_pagamento_entrada || '');

            const anyPayments = carne.parcelas?.some(p => p.pagamentos?.length > 0 || parseFloat(p.valor_pago) > 0);
            setHasPayments(anyPayments);
            if (anyPayments) {
                setEditWarningMessage('Este carnê possui pagamentos. Apenas Descrição, Data da Venda, Status e Observações podem ser alterados.');
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
                    setDataVenda(new Date().toISOString().split('T')[0]);
                    setLoadingInitial(false);
                }
            });
    }, [id, clientIdFromUrl, fetchCarneParaEdicao, setGlobalAlert]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);

        const vTotal = parseFloat(valorTotalOriginal);
        const vEntrada = parseFloat(valorEntrada) || 0;
        const nParcelas = parseInt(numeroParcelas);

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
        if (isNaN(nParcelas) || nParcelas <= 0) {
            setGlobalAlert({ message: 'Número de parcelas deve ser um inteiro positivo.', type: 'warning' });
            setSubmitLoading(false); return;
        }
        if (!dataPrimeiroVencimento) {
            setGlobalAlert({ message: 'Data do primeiro vencimento é obrigatória.', type: 'warning' });
            setSubmitLoading(false); return;
        }
        if (new Date(dataPrimeiroVencimento) < new Date(dataVenda) && !id) {
             setGlobalAlert({ message: 'A data do primeiro vencimento não pode ser anterior à data da venda.', type: 'warning' });
             setSubmitLoading(false); return;
        }
        if (vEntrada > 0 && !formaPagamentoEntrada) {
            setGlobalAlert({ message: 'Forma de pagamento da entrada é obrigatória se houver valor de entrada.', type: 'warning' });
            setSubmitLoading(false); return;
        }

        const valorAParcelar = vTotal - vEntrada;
        let valorParcelaCalculado = 0;
        if (nParcelas > 0 && valorAParcelar >= 0) {
            valorParcelaCalculado = valorAParcelar / nParcelas;
        } else if (valorAParcelar < 0) { 
            setGlobalAlert({ message: 'Valor a parcelar é negativo após deduzir a entrada.', type: 'error' });
            setSubmitLoading(false); return;
        }

        const carneData = {
            id_cliente: parseInt(idCliente),
            data_venda: dataVenda,
            descricao,
            valor_total_original: vTotal,
            numero_parcelas: nParcelas,
            valor_parcela_original: valorParcelaCalculado,
            data_primeiro_vencimento: dataPrimeiroVencimento,
            frequencia_pagamento: frequenciaPagamento,
            status_carne: statusCarne,
            observacoes,
            valor_entrada: vEntrada,
            forma_pagamento_entrada: vEntrada > 0 ? formaPagamentoEntrada : null
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

    if (loadingInitial) {
        return <LoadingSpinner message="Carregando dados do formulário..." />;
    }

    return (
        <div className="form-container">
            <h2>{id ? 'Editar Carnê' : 'Cadastrar Novo Carnê'}</h2>
            {editWarningMessage && <p className="text-center text-warning" style={{fontWeight: 'bold', marginBottom: '15px'}}>{editWarningMessage}</p>}
            
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="idCliente">Cliente:</label>
                    <select 
                        id="idCliente"
                        value={idCliente} 
                        onChange={(e) => setIdCliente(e.target.value)} 
                        required 
                        className="form-select" 
                        disabled={!!id || !!clientIdFromUrl || (id && hasPayments)}
                    >
                        <option value="">Selecione um Cliente</option>
                        {clientOptions.map(client => (<option key={client.id_cliente} value={client.id_cliente}>{client.nome} ({client.cpf_cnpj})</option>))}
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="dataVenda">Data da Venda/Emissão do Carnê:</label>
                    <input 
                        type="date" 
                        id="dataVenda"
                        value={dataVenda} 
                        onChange={(e) => setDataVenda(e.target.value)} 
                        required 
                        className="form-input" 
                        disabled={id && hasPayments}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="descricaoCarne">Descrição (Opcional):</label>
                    <input 
                        type="text" 
                        id="descricaoCarne"
                        value={descricao} 
                        onChange={(e) => setDescricao(e.target.value)} 
                        className="form-input"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="valorTotalOriginal">Valor Total Original da Dívida:</label>
                    <input 
                        type="number" 
                        id="valorTotalOriginal"
                        step="0.01" 
                        value={valorTotalOriginal} 
                        onChange={(e) => setValorTotalOriginal(e.target.value)} 
                        required 
                        className="form-input" 
                        disabled={id && hasPayments} 
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="valorEntrada">Valor de Entrada (Opcional):</label>
                    <input 
                        type="number" 
                        id="valorEntrada"
                        step="0.01" 
                        value={valorEntrada} 
                        onChange={(e) => setValorEntrada(e.target.value)} 
                        className="form-input" 
                        min="0" 
                        disabled={id && hasPayments} 
                    />
                </div>

                {parseFloat(valorEntrada) > 0 && (
                    <div className="form-group">
                        <label htmlFor="formaPagamentoEntrada">Forma de Pagamento da Entrada:</label>
                        <select 
                            id="formaPagamentoEntrada"
                            value={formaPagamentoEntrada} 
                            onChange={(e) => setFormaPagamentoEntrada(e.target.value)} 
                            required={parseFloat(valorEntrada) > 0} 
                            className="form-select" 
                            disabled={id && hasPayments}
                        >
                            <option value="">Selecione...</option>
                            <option value="Dinheiro">Dinheiro</option>
                            <option value="PIX">PIX</option>
                            <option value="Cartão de Crédito">Cartão de Crédito</option>
                            <option value="Débito">Débito</option>
                        </select>
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="numeroParcelas">Número de Parcelas:</label>
                    <input 
                        type="number" 
                        id="numeroParcelas"
                        value={numeroParcelas} 
                        onChange={(e) => setNumeroParcelas(e.target.value)} 
                        required 
                        className="form-input" 
                        disabled={id && hasPayments} 
                        min="1"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="dataPrimeiroVencimento">Data do Primeiro Vencimento:</label>
                    <input 
                        type="date" 
                        id="dataPrimeiroVencimento"
                        value={dataPrimeiroVencimento} 
                        onChange={(e) => setDataPrimeiroVencimento(e.target.value)} 
                        required 
                        className="form-input" 
                        disabled={id && hasPayments} 
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="frequenciaPagamento">Frequência de Pagamento:</label>
                    <select 
                        id="frequenciaPagamento"
                        value={frequenciaPagamento} 
                        onChange={(e) => setFrequenciaPagamento(e.target.value)} 
                        required 
                        className="form-select" 
                        disabled={id && hasPayments}
                    >
                        <option value="mensal">Mensal</option>
                        <option value="quinzenal">Quinzenal</option>
                        <option value="trimestral">Trimestral</option>
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="statusCarne">Status do Carnê:</label>
                    <select 
                        id="statusCarne"
                        value={statusCarne} 
                        onChange={(e) => setStatusCarne(e.target.value)} 
                        required 
                        className="form-select"
                    >
                        <option value="Ativo">Ativo</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="observacoesCarne">Observações (Opcional):</label>
                    <textarea 
                        id="observacoesCarne"
                        value={observacoes} 
                        onChange={(e) => setObservacoes(e.target.value)} 
                        rows="3" 
                        className="form-textarea"
                    ></textarea>
                </div>

                <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                    {submitLoading ? 'Salvando...' : (id ? 'Atualizar Carnê' : 'Cadastrar Carnê')}
                </button>
                <button type="button" onClick={() => navigate('/carnes')} className="btn btn-secondary mt-2">
                    Cancelar
                </button>
            </form>
        </div>
    );
}

export default CarneForm;