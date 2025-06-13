import React, { useState, useEffect, useCallback } from 'react';
import { clients } from '../api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx';

// Importações do Material-UI
import Button from '@mui/material/Button';
import Box from '@mui/material/Box'; // Para agrupar elementos com flexbox
import Typography from '@mui/material/Typography'; // Para títulos e textos
import Container from '@mui/material/Container'; // Para o layout principal da página
import Paper from '@mui/material/Paper'; // Para contêineres com sombra e padding (substitui card/form-container)
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField'; // Para inputs de busca

function ClientsPage() {
    const [clientList, setClientList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    const [showDeleteClientModal, setShowDeleteClientModal] = useState(false);
    const [clientToDeleteId, setClientToDeleteId] = useState(null);

    const fetchClients = useCallback(async (query = '') => {
        try {
            setLoading(true);
            const response = await clients.getAll(query);
            setClientList(response.data || []);
        } catch (err) {
            console.error('Erro ao buscar clientes:', err);
            setGlobalAlert({ message: 'Falha ao carregar clientes. Faça login novamente.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [setGlobalAlert]);

    useEffect(() => {
        fetchClients(searchQuery);
    }, [fetchClients, searchQuery]);

    const handleClearSearch = () => {
        setSearchQuery('');
    };

    const handleOpenDeleteClientModal = (id) => {
        setClientToDeleteId(id);
        setShowDeleteClientModal(true);
    };

    const handleCancelDeleteClient = () => {
        setShowDeleteClientModal(false);
        setClientToDeleteId(null);
    };

    const performDeleteClient = async () => {
        if (!clientToDeleteId) return;
        try {
            await clients.delete(clientToDeleteId);
            setGlobalAlert({ message: 'Cliente excluído com sucesso!', type: 'success' });
            fetchClients(searchQuery);
        } catch (err) {
            const errorMessage = `Falha ao excluir cliente: ${err.response?.data?.detail || err.message}`;
            setGlobalAlert({ message: errorMessage, type: 'error' });
        } finally {
            setShowDeleteClientModal(false);
            setClientToDeleteId(null);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Carregando clientes..." />;
    }

    return (
        <>
            <Container maxWidth="lg" className="py-8"> {/* Container para o layout principal */}
                <Box className="flex justify-between items-center mb-6 flex-wrap gap-4"> {/* Flexbox para título e botão */}
                    <Typography variant="h4" component="h1" className="font-bold text-gray-800 flex-grow"> {/* Título com Typography */}
                        Gerenciamento de Clientes
                    </Typography>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => navigate('/clients/new')}
                        className="py-2 px-4 whitespace-nowrap" // Tailwind para padding e evitar quebra de linha
                    >
                        + Novo Cliente
                    </Button>
                </Box>

                <Paper elevation={3} className="p-6 mb-8 rounded-lg"> {/* Contêiner para a busca e filtro */}
                    <Box className="flex flex-col sm:flex-row gap-4 items-center"> {/* Flexbox para os campos de busca e botão */}
                        <TextField
                            fullWidth
                            id="searchQuery"
                            label="Buscar por nome ou CPF/CNPJ"
                            type="text"
                            placeholder="Buscar por nome ou CPF/CNPJ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            variant="outlined"
                            size="small"
                            className="flex-grow" // Faz o campo de texto crescer
                        />
                        <Button
                            variant="outlined"
                            color="secondary"
                            onClick={handleClearSearch}
                            className="py-2 px-4 whitespace-nowrap" // Tailwind para padding e evitar quebra de linha
                        >
                            Limpar Busca
                        </Button>
                    </Box>
                </Paper>
                
                {clientList.length === 0 && !searchQuery ? (
                    <Typography className="text-center p-4 bg-gray-50 rounded-md text-gray-600 italic">
                        Nenhum cliente cadastrado.
                    </Typography>
                ) : clientList.length === 0 && searchQuery ? (
                    <Typography className="text-center p-4 bg-gray-50 rounded-md text-gray-600 italic">
                        Nenhum cliente encontrado para "{searchQuery}".
                    </Typography>
                ) : (
                    <TableContainer component={Paper} elevation={3} className="rounded-lg"> {/* Contêiner para a tabela */}
                        <Table>
                            <TableHead className="bg-gray-200"> {/* Cabeçalho da tabela com cor de fundo */}
                                <TableRow>
                                    <TableCell>Nome</TableCell>
                                    <TableCell>CPF/CNPJ</TableCell>
                                    <TableCell>Telefone</TableCell>
                                    <TableCell>Ações</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {clientList.map((client) => (
                                    <TableRow key={client.id_cliente} className="hover:bg-gray-50"> {/* Efeito hover na linha */}
                                        <TableCell>{client.nome}</TableCell>
                                        <TableCell>{client.cpf_cnpj}</TableCell>
                                        <TableCell>{client.telefone || 'N/A'}</TableCell>
                                        <TableCell>
                                            <Box className="flex flex-wrap gap-2"> {/* Usa Box para flexbox e gap entre botões */}
                                                <Button
                                                    variant="contained"
                                                    color="info"
                                                    size="small" // Botões menores
                                                    onClick={() => navigate(`/clients/details/${client.id_cliente}`)}
                                                >
                                                    Resumo
                                                </Button>
                                                <Button
                                                    variant="contained"
                                                    color="warning"
                                                    size="small"
                                                    onClick={() => navigate(`/clients/edit/${client.id_cliente}`)}
                                                >
                                                    Editar
                                                </Button>
                                                {user?.perfil === 'admin' && (
                                                    <Button
                                                        variant="contained"
                                                        color="error"
                                                        size="small"
                                                        onClick={() => handleOpenDeleteClientModal(client.id_cliente)}
                                                    >
                                                        Excluir
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="contained"
                                                    color="secondary"
                                                    size="small"
                                                    onClick={() => navigate(`/clients/${client.id_cliente}/carnes`)}
                                                >
                                                    Ver Carnês
                                                </Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Container>

            <ConfirmationModal
                isOpen={showDeleteClientModal}
                title="Confirmar Exclusão de Cliente"
                message="Tem certeza que deseja excluir este cliente? Todos os carnês e pagamentos associados a ele também serão removidos. Esta ação não pode ser desfeita."
                onConfirm={performDeleteClient}
                onCancel={handleCancelDeleteClient}
                confirmText="Sim, Excluir Cliente"
                cancelText="Cancelar"
            />
        </>
    );
}

export default ClientsPage;