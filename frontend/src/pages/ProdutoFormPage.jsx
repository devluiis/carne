import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { produtos } from '../api';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

function ProdutoFormPage() {
    const navigate = useNavigate();
    const { id: produtoId } = useParams();
    const { setGlobalAlert } = useGlobalAlert();

    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');
    const [categoria, setCategoria] = useState('');
    const [marca, setMarca] = useState('');
    const [imei, setImei] = useState('');
    const [codigoSku, setCodigoSku] = useState('');
    const [precoVenda, setPrecoVenda] = useState('');
    const [precoCusto, setPrecoCusto] = useState('');
    const [estoqueAtual, setEstoqueAtual] = useState('0');
    const [unidadeMedida, setUnidadeMedida] = useState('unidade');

    const [loadingInitial, setLoadingInitial] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [formError, setFormError] = useState('');

    const isEditing = Boolean(produtoId);

    const fetchProdutoData = useCallback(async () => {
        if (isEditing) {
            setLoadingInitial(true);
            try {
                const response = await produtos.getById(produtoId);
                const produto = response.data;
                setNome(produto.nome || '');
                setDescricao(produto.descricao || '');
                setCategoria(produto.categoria || '');
                setMarca(produto.marca || '');
                setImei(produto.imei || '');
                setCodigoSku(produto.codigo_sku || '');
                setPrecoVenda(produto.preco_venda !== null ? String(produto.preco_venda) : '');
                setPrecoCusto(produto.preco_custo !== null ? String(produto.preco_custo) : '');
                setEstoqueAtual(produto.estoque_atual !== null ? String(produto.estoque_atual) : '0');
                setUnidadeMedida(produto.unidade_medida || 'unidade');
            } catch (error) {
                console.error("Erro ao carregar produto para edição:", error);
                setGlobalAlert({ message: `Erro ao carregar produto: ${error.response?.data?.detail || error.message}`, type: 'error' });
                navigate('/produtos');
            } finally {
                setLoadingInitial(false);
            }
        }
    }, [isEditing, produtoId, navigate, setGlobalAlert]);

    useEffect(() => {
        fetchProdutoData();
    }, [fetchProdutoData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        setSubmitLoading(true);

        if (!nome.trim()) {
            setFormError('O nome do produto é obrigatório.');
            setGlobalAlert({ message: 'O nome do produto é obrigatório.', type: 'warning' });
            setSubmitLoading(false);
            return;
        }

        const produtoData = {
            nome: nome.trim(),
            descricao: descricao.trim() || null,
            categoria: categoria.trim() || null,
            marca: marca.trim() || null,
            imei: imei.trim() || null,
            codigo_sku: codigoSku.trim() || null,
            preco_venda: precoVenda !== '' ? parseFloat(precoVenda) : null,
            preco_custo: precoCusto !== '' ? parseFloat(precoCusto) : null,
            estoque_atual: estoqueAtual !== '' ? parseInt(estoqueAtual, 10) : 0,
            unidade_medida: unidadeMedida.trim() || 'unidade',
        };

        try {
            if (isEditing) {
                await produtos.update(produtoId, produtoData);
                setGlobalAlert({ message: 'Produto atualizado com sucesso!', type: 'success' });
            } else {
                await produtos.create(produtoData);
                setGlobalAlert({ message: 'Produto cadastrado com sucesso!', type: 'success' });
            }
            navigate('/produtos');
        } catch (error) {
            console.error("Erro ao salvar produto:", error);
            const errorMsg = error.response?.data?.detail || error.message || "Ocorreu um erro desconhecido.";
            setFormError(errorMsg);
            setGlobalAlert({ message: `Erro ao salvar produto: ${errorMsg}`, type: 'error' });
        } finally {
            setSubmitLoading(false);
        }
    };

    if (loadingInitial) {
        return <LoadingSpinner message={isEditing ? "Carregando dados do produto..." : "Preparando formulário..."} />;
    }

    return (
        <div className="form-container">
            <h2>{isEditing ? 'Editar Produto' : 'Cadastrar Novo Produto'}</h2>
            {formError && <p className="text-center text-danger" style={{marginBottom: '15px'}}>{formError}</p>}
            
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="nome">Nome do Produto: <span className="required-star">*</span></label>
                    <input type="text" id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required className="form-input" maxLength={255} />
                </div>

                <div className="form-group">
                    <label htmlFor="descricao">Descrição:</label>
                    <textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="form-textarea" rows="3"></textarea>
                </div>

                <div className="form-row"> {/* Nova classe para alinhar 2 colunas */}
                    <div className="form-group">
                        <label htmlFor="categoria">Categoria:</label>
                        <input type="text" id="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="form-input" maxLength={100} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="marca">Marca:</label>
                        <input type="text" id="marca" value={marca} onChange={(e) => setMarca(e.target.value)} className="form-input" maxLength={100} />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="imei">IMEI (para celulares):</label>
                        <input type="text" id="imei" value={imei} onChange={(e) => setImei(e.target.value)} className="form-input" maxLength={50} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="codigoSku">Código SKU:</label>
                        <input type="text" id="codigoSku" value={codigoSku} onChange={(e) => setCodigoSku(e.target.value)} className="form-input" maxLength={50} />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="precoVenda">Preço de Venda (R$):</label>
                        <input type="number" id="precoVenda" value={precoVenda} onChange={(e) => setPrecoVenda(e.target.value)} step="0.01" min="0" className="form-input" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="precoCusto">Preço de Custo (R$):</label>
                        <input type="number" id="precoCusto" value={precoCusto} onChange={(e) => setPrecoCusto(e.target.value)} step="0.01" min="0" className="form-input" />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="estoqueAtual">Estoque Atual:</label>
                        <input type="number" id="estoqueAtual" value={estoqueAtual} onChange={(e) => setEstoqueAtual(e.target.value)} step="1" min="0" className="form-input" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="unidadeMedida">Unidade de Medida:</label>
                        <input type="text" id="unidadeMedida" value={unidadeMedida} onChange={(e) => setUnidadeMedida(e.target.value)} className="form-input" maxLength={20} placeholder="Ex: unidade, pç, kg" />
                    </div>
                </div>

                <div className="form-actions mt-3"> {/* Nova classe para os botões do formulário */}
                    <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                        {submitLoading ? 'Salvando...' : (isEditing ? 'Atualizar Produto' : 'Cadastrar Produto')}
                    </button>
                    <button type="button" onClick={() => navigate('/produtos')} className="btn btn-secondary mt-2">
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    );
}

export default ProdutoFormPage;