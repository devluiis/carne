import React, { useState, useEffect, useCallback } from 'react'; // Adicionado useCallback
import { carnes, clients } from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx'; // <<<< IMPORTAR O MODAL

function CarnesPage() {
    const [carnesList, setCarnesList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(''); // Mantido para erros de carregamento da página, se necessário
    const navigate = useNavigate();
    const { id_cliente } = useParams();
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    const [clientOptions, setClientOptions] = useState([]);
    const [clienteSelecionadoParaNovoCarne, setClienteSelecionadoParaNovoCarne] = useState(id_cliente || '');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterSearchQuery, setFilterSearchQuery] = useState('');

    // Estados para o modal de confirmação de exclusão
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [carneToDeleteId, setCarneToDeleteId] = useState(null);

    // Envolver fetchCarnes e fetchClientOptions com useCallback
    const fetchCarnes = useCallback(async () => {
        try {
            setLoading(true);
            setError(''); // Limpa erro anterior
            const response = await carnes.getAll(id_cliente, filterStatus, filterDateStart, filterDateEnd, filterSearchQuery);
            setCarnesList(response.data || []); // Garante que seja um array
        } catch (err) {
            console.error('Erro ao buscar carnês:', err);
            setError('Falha ao carregar carnês.'); // Pode ser usado para exibir uma mensagem na página se preferir
            setGlobalAlert({ message: 'Falha ao carregar carnês. Faça login novamente ou verifique as permissões.', type: 'error' });
            if (err.response && err.response.status === 401) {
                navigate('/');
            }
        } finally {
            setLoading(false);
        }
    }, [id_cliente, filterStatus, filterDateStart, filterDateEnd, filterSearchQuery, setGlobalAlert, navigate]); // Adicionar dependências

    const fetchClientOptions = useCallback(async () => {
        if (id_cliente) return; // Não busca se já está filtrando por um cliente específico na URL
        try {
            const response = await clients.getAll();
            setClientOptions(response.data || []); // Garante que seja um array
        } catch (err) {
            console.error('Erro ao carregar opções de clientes:', err);
            // Opcional: setGlobalAlert({ message: 'Falha ao carregar lista de clientes.', type: 'warning' });
        }
    }, [id_cliente]); // Adicionar dependências

    useEffect(() => {
        if (user) {
            fetchCarnes();
            fetchClientOptions();
        } else {
            setLoading(false);
            // setError('Faça login para ver os carnês.'); // GlobalAlert já está tratando
            setGlobalAlert({ message: 'Faça login para ver os carnês.', type: 'error' });
        }
    // Removido filterStatus, etc., da dependência do useEffect principal
    // para evitar re-fetching excessivo. fetchCarnes agora é chamado pelo botão "Aplicar Filtros"
    // ou quando o componente monta/usuário muda. Ou pode adicionar as dependências de filtro
    // de volta se quiser re-fetch automático ao mudar filtros.
    // Por ora, vamos manter o botão "Aplicar Filtros" como o gatilho.
    }, [user, id_cliente, fetchCarnes, fetchClientOptions, setGlobalAlert]); // fetchCarnes e fetchClientOptions como dependências


    const handleOpenDeleteModal = (id) => { // <<<< NOVA FUNÇÃO PARA ABRIR O MODAL
        setCarneToDeleteId(id);
        setShowDeleteConfirmModal(true);
    };

    const handleCancelDelete = () => { // <<<< NOVA FUNÇÃO PARA CANCELAR EXCLUSÃO
        setShowDeleteConfirmModal(false);
        setCarneToDeleteId(null);
    };

    const performDeleteCarne = async () => { // <<<< NOVA FUNÇÃO PARA EXECUTAR A EXCLUSÃO
        if (!carneToDeleteId) return;
        try {
            await carnes.delete(carneToDeleteId);
            setGlobalAlert({ message: 'Carnê excluído com sucesso!', type: 'success' });
            fetchCarnes(); // Atualiza a lista
        } catch (err) {
            console.error('Erro ao excluir carnê:', err);
            const errorMessage = `Falha ao excluir carnê: ${err.response?.data?.detail || err.message || 'Erro desconhecido.'}`;
            // setError(errorMessage); // GlobalAlert já está tratando
            setGlobalAlert({ message: errorMessage, type: 'error' });
        } finally {
            setShowDeleteConfirmModal(false);
            setCarneToDeleteId(null);
        }
    };


    const handleAdicionarNovoCarne = () => {
        const targetClientId = id_cliente || clienteSelecionadoParaNovoCarne;
        if (!targetClientId) {
            setGlobalAlert({ message: 'Por favor, selecione um cliente antes de adicionar um novo carnê.', type: 'warning' });
            return;
        }
        navigate(`/carnes/new/${targetClientId}`);
    };
    
    const handleClearFilters = () => {
        setFilterStatus('');
        setFilterDateStart('');
        setFilterDateEnd('');
        setFilterSearchQuery('');
        // Chama fetchCarnes sem filtros para resetar a lista, ou
        // o useEffect com dependências de filtro faria isso se configurado
        // Para ser explícito, chamaremos fetchCarnes aqui também, mas com id_cliente original
        // A função fetchCarnes dentro do useCallback já pega os estados de filtro atuais
        // Se eles foram limpos, a próxima chamada a fetchCarnes os usará vazios.
        // Opcionalmente, você pode passar os filtros vazios diretamente:
        // fetchCarnes(id_cliente, null, null, null, null); // Isso requer mudar a assinatura de fetchCarnes
        // A forma mais simples é deixar o useEffect (se tiver os filtros como dependência) ou o botão "Aplicar" cuidar.
        // Para o botão Limpar, é melhor forçar uma busca sem filtros.
        // Criamos uma função específica para isso para clareza:
        refetchWithoutFilters();
    };

    const refetchWithoutFilters = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const response = await carnes.getAll(id_cliente, null, null, null, null); // Força sem filtros
            setCarnesList(response.data || []);
        } catch (err) {
            // ... (tratamento de erro como em fetchCarnes) ...
             setGlobalAlert({ message: 'Falha ao limpar filtros e recarregar carnês.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [id_cliente, setGlobalAlert]);


    if (loading) {
        return <LoadingSpinner message="Carregando carnês..." />;
    }

    // Opcional: exibir erro localmente se GlobalAlert não for suficiente para o contexto da página
    if (error && carnesList.length === 0) {
        return <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>;
    }

    return (
        <> {/* Adicionado React.Fragment para o Modal */}
            <div className="table-container"> {/* Usando classe do index.css */}
                <h2 className="text-center">
                    Lista de Carnês 
                    {id_cliente && clientOptions.find(c => String(c.id_cliente) === id_cliente) ? 
                    `: Cliente ${clientOptions.find(c => String(c.id_cliente) === id_cliente).nome}` : ''}
                </h2>
                
                {/* Seção de Filtros */}
                <div className="form-container" style={{maxWidth: 'none', margin: '0 0 20px 0', padding: '20px'}}>
                    <h3>Filtrar Carnês:</h3>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'flex-end'}}>
                        <div className="form-group">
                            <label>Status:</label>
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-select">
                                <option value="">Todos</option>
                                <option value="Ativo">Ativo</option>
                                <option value="Quitado">Quitado</option>
                                <option value="Em Atraso">Em Atraso</option>
                                <option value="Cancelado">Cancelado</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Vencimento De:</label>
                            <input type="date" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label>Vencimento Até:</label>
                            <input type="date" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label>Descrição ou Cliente:</label>
                            <input
                                type="text"
                                placeholder="Descrição, Nome ou CPF/CNPJ"
                                value={filterSearchQuery}
                                onChange={(e) => setFilterSearchQuery(e.target.value)}
                                className="form-input"
                            />
                        </div>
                        <div className="form-group" style={{display: 'flex', gap: '10px'}}>
                            <button onClick={fetchCarnes} className="btn btn-primary" style={{width: '100%'}}>Aplicar Filtros</button>
                            <button onClick={handleClearFilters} className="btn btn-secondary" style={{width: '100%'}}>Limpar Filtros</button>
                        </div>
                    </div>
                </div>

                {/* Seção para Adicionar Novo Carnê */}
                {!id_cliente && ( // Só mostra se não estiver na página de carnês de um cliente específico
                    <div className="form-container" style={{maxWidth: 'none', margin: '0 0 20px 0', padding: '20px', display: 'flex', alignItems: 'flex-end', gap: '15px'}}>
                        <div className="form-group" style={{flexGrow: 1}}>
                            <label>Selecione o Cliente para Novo Carnê:</label>
                            <select
                                value={clienteSelecionadoParaNovoCarne}
                                onChange={(e) => setClienteSelecionadoParaNovoCarne(e.target.value)}
                                className="form-select"
                            >
                                <option value="">-- Selecione um Cliente --</option>
                                {clientOptions.map(client => (
                                    <option key={client.id_cliente} value={client.id_cliente}>
                                        {client.nome} ({client.cpf_cnpj})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={handleAdicionarNovoCarne}
                            className="btn btn-success"
                            style={{width: 'auto', marginBottom: '20px'}}
                            disabled={!clienteSelecionadoParaNovoCarne}
                        >
                            + Adicionar Carnê
                        </button>
                    </div>
                )}
                 {id_cliente && ( // Se estiver na página de um cliente específico
                     <button onClick={handleAdicionarNovoCarne} className="btn btn-success" style={{width: 'auto', marginBottom: '20px'}}>
                        + Adicionar Carnê para este Cliente
                    </button>
                 )}


                {carnesList.length === 0 ? (
                    <p className="text-center" style={{padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '5px'}}>
                        Nenhum carnê encontrado com os filtros aplicados.
                    </p>
                ) : (
                    <table className="styled-table">
                        <thead>
                            <tr>
                                <th >Cliente</th>
                                <th >Descrição</th>
                                <th >Data Venda</th>
                                <th >Valor Total</th>
                                <th >Entrada</th>
                                <th >Nº Parc.</th>
                                <th >Status</th>
                                <th >Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {carnesList.map((carne) => (
                                <tr key={carne.id_carne}>
                                    <td>{carne.cliente?.nome || 'N/A'}</td>
                                    <td>{carne.descricao || 'N/A'}</td>
                                    <td>{carne.data_venda ? new Date(carne.data_venda + 'T00:00:00').toLocaleDateString() : 'N/A'}</td>
                                    <td>R$ {Number(carne.valor_total_original).toFixed(2)}</td>
                                    <td>R$ {Number(carne.valor_entrada || 0).toFixed(2)}</td>
                                    <td>{carne.numero_parcelas}</td>
                                    <td>
                                        <span style={getStatusStyle(carne.status_carne)}>
                                            {carne.status_carne}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="table-actions">
                                            <button onClick={() => navigate(`/carnes/details/${carne.id_carne}`)} className="btn btn-info btn-sm">Detalhes</button>
                                            <button onClick={() => navigate(`/carnes/edit/${carne.id_carne}`)} className="btn btn-warning btn-sm">Editar</button>
                                            {user?.perfil === 'admin' && 
                                                <button onClick={() => handleOpenDeleteModal(carne.id_carne)} className="btn btn-danger btn-sm">Excluir</button>
                                            }
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Renderiza o Modal de Confirmação */}
            <ConfirmationModal
                isOpen={showDeleteConfirmModal}
                title="Confirmar Exclusão de Carnê"
                message="Tem certeza que deseja excluir este carnê e todas as suas parcelas e pagamentos associados? Esta ação não pode ser desfeita."
                onConfirm={performDeleteCarne}
                onCancel={handleCancelDelete}
                confirmText="Sim, Excluir"
                cancelText="Cancelar"
            />
        </>
    );
}

// Mantendo estilos inline que eram específicos deste componente e não foram para o index.css
// Idealmente, muitos destes poderiam virar classes também.
// const containerStyle = { maxWidth: '1000px', margin: '20px auto', padding: '20px', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
// const headerStyle = { textAlign: 'center', marginBottom: '20px' };
// ... e outros que você tinha definido como constantes de estilo.
// Por agora, usei as classes .table-container e .form-container do index.css onde apropriado.

// Função getStatusStyle (importante estar aqui ou importada de utils)
const getStatusStyle = (status) => {
    switch (status) {
        case 'Quitado': return { color: '#28a745', fontWeight: 'bold' };
        case 'Em Atraso': return { color: '#dc3545', fontWeight: 'bold' };
        case 'Cancelado': return { color: '#6c757d', fontWeight: 'bold' };
        case 'Ativo':
        default: return { color: '#007bff', fontWeight: 'bold' };
    }
};

export default CarnesPage;