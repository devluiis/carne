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
    const [valorParcelaSugerido, setValorParcelaSugerido] = useState('');
    const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState('');
    const [frequenciaPagamento, setFrequenciaPagamento] = useState('mensal');
    const [statusCarne, setStatusCarne] = useState('Ativo');
    const [observacoes, setObservacoes] = useState('');
    const [valorEntrada, setValorEntrada] = useState('');
    const [formaPagamentoEntrada, setFormaPagamentoEntrada] = useState('');
    const [parcelaFixa, setParcelaFixa] = useState(true); // NOVO ESTADO: true por padrão

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
            setValorParcelaSugerido(String(carne.valor_parcela_original)); // Para carnês fixos, use o valor original. Para flexíveis, será o total.
            setDataPrimeiroVencimento(carne.data_primeiro_vencimento ? new Date(carne.data_primeiro_vencimento + 'T00:00:00').toISOString().split('T')[0] : '');
            setFrequenciaPagamento(carne.frequencia_pagamento);
            setStatusCarne(carne.status_carne);
            setObservacoes(carne.observacoes || '');
            setValorEntrada(String(carne.valor_entrada || 0));
            setFormaPagamentoEntrada(carne.forma_pagamento_entrada || '');
            setParcelaFixa(carne.parcela_fixa); // Define o estado do checkbox

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
        let nParcelas = parseInt(numeroParcelas); // Pode ser 1 para carnês flexíveis
        const vParcelaSugerido = parseFloat(valorParcelaSugerido);

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

        // Validações específicas para parcela fixa
        if (parcelaFixa) {
            if (isNaN(nParcelas) || nParcelas <= 0) {
                setGlobalAlert({ message: 'Para carnês com parcela fixa, o número de parcelas deve ser um inteiro positivo.', type: 'warning' });
                setSubmitLoading(false); return;
            }
            if (valorParcelaSugerido !== '' && (isNaN(vParcelaSugerido) || vParcelaSugerido <= 0)) {
                setGlobalAlert({ message: 'Valor sugerido da parcela deve ser um número positivo.', type: 'warning' });
                setSubmitLoading(false); return;
            }
            if (valorParcelaSugerido !== '' && vParcelaSugerido * nParcelas < (vTotal - vEntrada) && nParcelas > 1) {
                setGlobalAlert({ message: 'A soma das parcelas sugeridas é menor que o valor a parcelar. A última parcela será ajustada para um valor maior.', type: 'info' });
            }
        } else { // Para carnê não fixo
            nParcelas = 1; // Força para 1 parcela no backend
            // Limpa valorParcelaSugerido, pois não é aplicável
            // setValorParcelaSugerido(''); // Isso não deve ser feito aqui, apenas na montagem da requisição
        }


        const carneData = {
            id_cliente: parseInt(idCliente),
            data_venda: dataVenda,
            descricao,
            valor_total_original: vTotal,
            numero_parcelas: nParcelas,
            valor_parcela_sugerido: parcelaFixa && valorParcelaSugerido !== '' ? vParcelaSugerido : null, // Envia o sugerido APENAS se for parcela fixa
            data_primeiro_vencimento: dataPrimeiroVencimento,
            frequencia_pagamento: parcelaFixa ? frequenciaPagamento : "única", // Frequência padrão para não fixo
            status_carne: statusCarne,
            observacoes,
            valor_entrada: vEntrada,
            forma_pagamento_entrada: vEntrada > 0 ? formaPagamentoEntrada : null,
            parcela_fixa: parcelaFixa // Envia o novo campo
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
        <div className="form-container">
            <h2>{id ? 'Editar Carnê' : 'Cadastrar Novo Carnê'}</h2>
            {editWarningMessage && <p className="text-center text-warning" style={{fontWeight: 'bold', marginBottom: '15px'}}>{editWarningMessage}</p>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="idCliente">Cliente:<span className="required-star">*</span></label>
                    <select
                        id="idCliente"
                        value={idCliente}
                        onChange={(e) => setIdCliente(e.target.value)}
                        required
                        className="form-select"
                        disabled={isFinancialFieldDisabled || !!clientIdFromUrl || id}
                    >
                        <option value="">Selecione um Cliente</option>
                        {clientOptions.map(client => (<option key={client.id_cliente} value={client.id_cliente}>{client.nome} ({client.cpf_cnpj})</option>))}
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="dataVenda">Data da Venda/Emissão do Carnê:<span className="required-star">*</span></label>
                    <input
                        type="date"
                        id="dataVenda"
                        value={dataVenda}
                        onChange={(e) => setDataVenda(e.target.value)}
                        required
                        className="form-input"
                        disabled={isFinancialFieldDisabled}
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
                    <label htmlFor="valorTotalOriginal">Valor Total Original da Dívida:<span className="required-star">*</span></label>
                    <input
                        type="number"
                        id="valorTotalOriginal"
                        step="0.01"
                        value={valorTotalOriginal}
                        onChange={(e) => setValorTotalOriginal(e.target.value)}
                        required
                        className="form-input"
                        disabled={isFinancialFieldDisabled}
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
                        disabled={isFinancialFieldDisabled}
                    />
                </div>

                {parseFloat(valorEntrada) > 0 && (
                    <div className="form-group">
                        <label htmlFor="formaPagamentoEntrada">Forma de Pagamento da Entrada:<span className="required-star">*</span></label>
                        <select
                            id="formaPagamentoEntrada"
                            value={formaPagamentoEntrada}
                            onChange={(e) => setFormaPagamentoEntrada(e.target.value)}
                            required={parseFloat(valorEntrada) > 0}
                            className="form-select"
                            disabled={isFinancialFieldDisabled}
                        >
                            <option value="">Selecione...</option>
                            <option value="Dinheiro">Dinheiro</option>
                            <option value="PIX">PIX</option>
                            <option value="Cartão de Crédito">Cartão de Crédito</option>
                            <option value="Débito">Débito</option>
                        </select>
                    </div>
                )}

                {/* NOVO CAMPO: Parcela Fixa */}
                <div className="form-group">
                    <input
                        type="checkbox"
                        id="parcelaFixa"
                        checked={parcelaFixa}
                        onChange={(e) => setParcelaFixa(e.target.checked)}
                        disabled={isFinancialFieldDisabled}
                        style={{ marginRight: '10px' }}
                    />
                    <label htmlFor="parcelaFixa" style={{ display: 'inline' }}>Carnê com parcelas de valor fixo?</label>
                    <small className="form-text-muted" style={{ display: 'block', marginTop: '5px' }}>
                        Desmarque para permitir pagamentos flexíveis em uma única parcela.
                    </small>
                </div>

                {parcelaFixa ? (
                    <>
                        <div className="form-group">
                            <label htmlFor="numeroParcelas">Número de Parcelas:<span className="required-star">*</span></label>
                            <input
                                type="number"
                                id="numeroParcelas"
                                value={numeroParcelas}
                                onChange={(e) => setNumeroParcelas(e.target.value)}
                                required
                                className="form-input"
                                disabled={isFinancialFieldDisabled}
                                min="1"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="valorParcelaSugerido">Valor Sugerido por Parcela (Opcional):</label>
                            <input
                                type="number"
                                id="valorParcelaSugerido"
                                step="0.01"
                                value={valorParcelaSugerido}
                                onChange={(e) => setValorParcelaSugerido(e.target.value)}
                                className="form-input"
                                min="0.01"
                                disabled={isFinancialFieldDisabled}
                            />
                            <small className="form-text-muted">Se preenchido, a última parcela será ajustada para fechar o valor total.</small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="frequenciaPagamento">Frequência de Pagamento:<span className="required-star">*</span></label>
                            <select
                                id="frequenciaPagamento"
                                value={frequenciaPagamento}
                                onChange={(e) => setFrequenciaPagamento(e.target.value)}
                                required
                                className="form-select"
                                disabled={isFinancialFieldDisabled}
                            >
                                <option value="mensal">Mensal</option>
                                <option value="quinzenal">Quinzenal</option>
                                <option value="trimestral">Trimestral</option>
                            </select>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Se não for parcela fixa, exibe mensagem e desabilita/oculta campos irrelevantes */}
                        <div className="form-group">
                            <label htmlFor="numeroParcelas">Número de Parcelas:</label>
                            <input
                                type="number"
                                id="numeroParcelas"
                                value="1" // Forçado a 1
                                disabled
                                className="form-input"
                            />
                            <small className="form-text-muted">Carnês flexíveis são tratados como 1 parcela para o saldo total.</small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="frequenciaPagamento">Frequência de Pagamento:</label>
                            <input
                                type="text"
                                id="frequenciaPagamento"
                                value="Única / Variável"
                                disabled
                                className="form-input"
                            />
                            <small className="form-text-muted">Pagamentos podem ser feitos a qualquer momento para abater o saldo.</small>
                        </div>
                    </>
                )}

                <div className="form-group">
                    <label htmlFor="dataPrimeiroVencimento">Data do Primeiro Vencimento:<span className="required-star">*</span></label>
                    <input
                        type="date"
                        id="dataPrimeiroVencimento"
                        value={dataPrimeiroVencimento}
                        onChange={(e) => setDataPrimeiroVencimento(e.target.value)}
                        required
                        className="form-input"
                        disabled={isFinancialFieldDisabled}
                    />
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