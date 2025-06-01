import React, { useState, useEffect } from 'react';
import { carnes, clients } from '../api'; // Caminho corrigido para a raiz
import { useParams, useNavigate } from 'react-router-dom';

function CarneForm() {
    const [idCliente, setIdCliente] = useState('');
    const [descricao, setDescricao] = useState('');
    const [valorTotalOriginal, setValorTotalOriginal] = useState('');
    const [numeroParcelas, setNumeroParcelas] = useState('');
    const [valorParcelaOriginal, setValorParcelaOriginal] = useState('');
    const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState('');
    const [frequenciaPagamento, setFrequenciaPagamento] = useState('mensal'); // Default
    const [statusCarne, setStatusCarne] = useState('Ativo'); // Default
    const [observacoes, setObservacoes] = useState('');
    const [clientOptions, setClientOptions] = useState([]); // Para o dropdown de clientes

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { id, clientIdFromUrl } = useParams(); // id para edição, clientIdFromUrl para criação a partir de cliente

    // Novo estado para controlar se o carnê tem pagamentos (para desabilitar edição de campos)
    const [hasPayments, setHasPayments] = useState(false);
    const [editWarningMessage, setEditWarningMessage] = useState('');


    useEffect(() => {
        setLoading(true);
        // Carrega clientes para o dropdown
        clients.getAll()
            .then(response => {
                setClientOptions(response.data);
                // Se estiver criando um carnê a partir de um cliente existente, pré-seleciona
                if (clientIdFromUrl && !id) { // Apenas na criação
                    setIdCliente(clientIdFromUrl);
                }
            })
            .catch(err => {
                console.error("Erro ao carregar clientes para o formulário de carnê:", err);
                setError('Falha ao carregar clientes para seleção.');
            })
            .finally(() => {
                // Carrega dados do carnê para edição (só faz sentido se houver um ID de carnê para editar)
                if (id) {
                    carnes.getById(id)
                        .then(response => {
                            const carne = response.data;
                            setIdCliente(carne.id_cliente);
                            setDescricao(carne.descricao || '');
                            setValorTotalOriginal(carne.valor_total_original);
                            setNumeroParcelas(carne.numero_parcelas);
                            setValorParcelaOriginal(carne.valor_parcela_original);
                            // Formata a data para YYYY-MM-dd para input type="date"
                            setDataPrimeiroVencimento(carne.data_primeiro_vencimento ? new Date(carne.data_primeiro_vencimento).toISOString().split('T')[0] : '');
                            setFrequenciaPagamento(carne.frequencia_pagamento);
                            setStatusCarne(carne.status_carne);
                            setObservacoes(carne.observacoes || '');

                            // Verifica se há pagamentos para desabilitar campos
                            const hasAnyPayments = carne.parcelas.some(parcela => parcela.pagamentos && parcela.pagamentos.length > 0);
                            setHasPayments(hasAnyPayments);
                            if (hasAnyPayments) {
                                setEditWarningMessage('Este carnê possui pagamentos registrados. Apenas Descrição, Status e Observações podem ser alterados para evitar inconsistências.');
                            }
                        })
                        .catch(err => {
                            console.error('Erro ao carregar carnê para edição:', err);
                            setError('Erro ao carregar dados do carnê.');
                        })
                        .finally(() => { // Mova o setLoading(false) para dentro do finally do getById
                            setLoading(false);
                        });
                } else { // Se não for edição, termina o loading dos clientes
                    setLoading(false);
                }
            });
    }, [id, clientIdFromUrl]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Validações adicionais (opcional, mas recomendado)
        if (!idCliente || isNaN(parseInt(idCliente))) {
            setError('Por favor, selecione um cliente válido.');
            setLoading(false);
            return;
        }
        if (parseFloat(valorTotalOriginal) <= 0 || isNaN(parseFloat(valorTotalOriginal))) {
            setError('O valor total deve ser um número positivo.');
            setLoading(false);
            return;
        }
        if (parseInt(numeroParcelas) <= 0 || isNaN(parseInt(numeroParcelas))) {
            setError('O número de parcelas deve ser um número inteiro positivo.');
            setLoading(false);
            return;
        }
        if (parseFloat(valorParcelaOriginal) <= 0 || isNaN(parseFloat(valorParcelaOriginal))) {
            setError('O valor da parcela deve ser um número positivo.');
            setLoading(false);
            return;
        }
        if (!dataPrimeiroVencimento) {
            setError('A data do primeiro vencimento é obrigatória.');
            setLoading(false);
            return;
        }


        const carneData = {
            id_cliente: parseInt(idCliente),
            descricao,
            valor_total_original: parseFloat(valorTotalOriginal),
            numero_parcelas: parseInt(numeroParcelas),
            valor_parcela_original: parseFloat(valorParcelaOriginal),
            data_primeiro_vencimento: dataPrimeiroVencimento,
            frequencia_pagamento: frequenciaPagamento,
            status_carne: statusCarne,
            observacoes
        };

        try {
            if (id) {
                await carnes.update(id, carneData);
                alert('Carnê atualizado com sucesso!');
            } else {
                await carnes.create(carneData);
                alert('Carnê cadastrado com sucesso!');
            }
            navigate('/carnes'); // Redireciona para a lista de carnês
        } catch (err) {
            console.error('Erro ao salvar carnê:', err);
            setError(`Erro ao salvar carnê: ${err.response?.data?.detail || err.message || 'Erro desconhecido.'}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading && clientOptions.length === 0 && !id) return <p>Carregando dados...</p>; // Condição mais precisa para carregamento

    return (
        <div style={formContainerStyle}>
            <h2>{id ? 'Editar Carnê' : 'Cadastrar Novo Carnê'}</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {editWarningMessage && <p style={{ color: 'orange', fontWeight: 'bold' }}>{editWarningMessage}</p>} {/* Mensagem de aviso */}

            <form onSubmit={handleSubmit}>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Cliente:</label>
                    <select
                        value={idCliente}
                        onChange={(e) => setIdCliente(Number(e.target.value))} // Convertendo para número
                        required
                        style={inputStyle}
                        disabled={!!id || !!clientIdFromUrl || hasPayments} // Desabilita seleção de cliente na edição, criação a partir de cliente URL e se houver pagamentos
                    >
                        <option key="default-client-option" value="">Selecione um Cliente</option>
                        {clientOptions.map(client => (
                            <option key={client.id_cliente} value={client.id_cliente}> {/* AQUI: Usando id_cliente */}
                                {client.nome} ({client.cpf_cnpj})
                            </option>
                        ))}
                    </select>
                </div>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Descrição (Opcional):</label>
                    <input
                        type="text"
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        style={inputStyle}
                    />
                </div>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Valor Total Original:</label>
                    <input
                        type="number"
                        step="0.01"
                        value={valorTotalOriginal}
                        onChange={(e) => setValorTotalOriginal(e.target.value)}
                        required
                        style={inputStyle}
                        disabled={hasPayments} // Desabilita se houver pagamentos
                    />
                </div>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Número de Parcelas:</label>
                    <input
                        type="number"
                        value={numeroParcelas}
                        onChange={(e) => setNumeroParcelas(e.target.value)}
                        required
                        style={inputStyle}
                        disabled={hasPayments} // Desabilita se houver pagamentos
                    />
                </div>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Valor da Parcela Original:</label>
                    <input
                        type="number"
                        step="0.01"
                        value={valorParcelaOriginal}
                        onChange={(e) => setValorParcelaOriginal(e.target.value)}
                        required
                        style={inputStyle}
                        disabled={hasPayments} // Desabilita se houver pagamentos
                    />
                </div>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Data do Primeiro Vencimento:</label>
                    <input
                        type="date"
                        value={dataPrimeiroVencimento}
                        onChange={(e) => setDataPrimeiroVencimento(e.target.value)}
                        required
                        style={inputStyle}
                        disabled={hasPayments} // Desabilita se houver pagamentos
                    />
                </div>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Frequência de Pagamento:</label>
                    <select
                        value={frequenciaPagamento}
                        onChange={(e) => setFrequenciaPagamento(e.target.value)}
                        required
                        style={inputStyle}
                        disabled={hasPayments} // Desabilita se houver pagamentos
                    >
                        <option value="mensal">Mensal</option>
                        <option value="quinzenal">Quinzenal</option>
                        <option value="trimestral">Trimestral</option>
                        {/* Adicione outras frequências conforme necessário */}
                    </select>
                </div>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Status do Carnê:</label>
                    <select
                        value={statusCarne}
                        onChange={(e) => setStatusCarne(e.target.value)}
                        required
                        style={inputStyle}
                    >
                        <option value="Ativo">Ativo</option>
                        <option value="Quitado">Quitado</option>
                        <option value="Em Atraso">Em Atraso</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Observações (Opcional):</label>
                    <textarea
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        rows="3"
                        style={inputStyle}
                    ></textarea>
                </div>
                <button type="submit" disabled={loading} style={submitButtonStyle}>
                    {loading ? 'Salvando...' : (id ? 'Atualizar Carnê' : 'Cadastrar Carnê')}
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/carnes')}
                    style={cancelButtonStyle}
                >
                    Cancelar
                </button>
            </form>
        </div>
    );
}

const formContainerStyle = { maxWidth: '700px', margin: '20px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
const formGroupStyle = { marginBottom: '15px' };
const labelStyle = { display: 'block', marginBottom: '5px', fontWeight: 'bold' };
const inputStyle = { width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ddd' };
const submitButtonStyle = { width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const cancelButtonStyle = { width: '100%', padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' };

export default CarneForm;