import React, { useState, useEffect } from 'react';
import { clients } from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from './LoadingSpinner.jsx'; 

function ClientForm() {
    const [nome, setNome] = useState('');
    const [cpfCnpj, setCpfCnpj] = useState('');
    const [endereco, setEndereco] = useState('');
    const [telefone, setTelefone] = useState('');
    const [email, setEmail] = useState('');
    const [formError, setFormError] = useState(''); 
    const [loadingInitial, setLoadingInitial] = useState(false); 
    const [submitLoading, setSubmitLoading] = useState(false); 
    const navigate = useNavigate();
    const { id } = useParams();
    const { setGlobalAlert } = useGlobalAlert();

    const isEditing = Boolean(id);

    useEffect(() => {
        if (isEditing) {
            setLoadingInitial(true);
            clients.getById(id)
                .then(response => {
                    const client = response.data;
                    setNome(client.nome);
                    setCpfCnpj(client.cpf_cnpj);
                    setEndereco(client.endereco || '');
                    setTelefone(client.telefone || '');
                    setEmail(client.email || '');
                })
                .catch(err => {
                    console.error('Erro ao carregar cliente para edição:', err);
                    setGlobalAlert({ message: 'Erro ao carregar dados do cliente.', type: 'error' });
                    navigate('/clients');
                })
                .finally(() => setLoadingInitial(false));
        }
    }, [id, isEditing, navigate, setGlobalAlert]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError(''); 
        setSubmitLoading(true);
        const clientData = { nome, cpf_cnpj: cpfCnpj, endereco, telefone, email };

        try {
            if (isEditing) {
                await clients.update(id, clientData);
                setGlobalAlert({ message: 'Cliente atualizado com sucesso!', type: 'success' });
            } else {
                await clients.create(clientData);
                setGlobalAlert({ message: 'Cliente cadastrado com sucesso!', type: 'success' });
            }
            navigate('/clients');
        } catch (err) {
            const errorMessage = `Erro ao salvar cliente: ${err.response?.data?.detail || err.message}`;
            setFormError(errorMessage); 
            setGlobalAlert({ message: errorMessage, type: 'error' });
        } finally {
            setSubmitLoading(false);
        }
    };

    if (loadingInitial) {
        return <LoadingSpinner message={isEditing ? "Carregando dados do cliente..." : "Preparando formulário..."} />;
    }

    return (
        <div className="container form-container"> {/* Usando container do Bootstrap */}
            <h2 className="text-center">{isEditing ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</h2>
            {formError && <p className="text-danger text-center mb-3">{formError}</p>} {/* Classes Bootstrap para erro */}
            <form onSubmit={handleSubmit}>
                <div className="mb-3"> {/* mb-3 do Bootstrap */}
                    <label htmlFor="nome" className="form-label">Nome Completo / Razão Social:</label> {/* form-label do Bootstrap */}
                    <input
                        type="text"
                        id="nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        className="form-control" /* form-control do Bootstrap */
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="cpfCnpj" className="form-label">CPF / CNPJ:</label>
                    <input
                        type="text"
                        id="cpfCnpj"
                        value={cpfCnpj}
                        onChange={(e) => setCpfCnpj(e.target.value)}
                        required
                        className="form-control"
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="endereco" className="form-label">Endereço:</label>
                    <input
                        type="text"
                        id="endereco"
                        value={endereco}
                        onChange={(e) => setEndereco(e.target.value)}
                        className="form-control"
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="telefone" className="form-label">Telefone:</label>
                    <input
                        type="text"
                        id="telefone"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        className="form-control"
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="email" className="form-label">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="form-control"
                    />
                </div>
                <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                    {submitLoading ? 'Salvando...' : (isEditing ? 'Atualizar Cliente' : 'Cadastrar Cliente')}
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/clients')}
                    className="btn btn-secondary mt-2" 
                >
                    Cancelar
                </button>
            </form>
        </div>
    );
}

export default ClientForm;