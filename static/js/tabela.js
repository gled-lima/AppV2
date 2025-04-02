document.addEventListener('DOMContentLoaded', function() {
    // Elementos do DOM
    const filtroCidade = document.getElementById('filtroCidade');
    const filtroEstado = document.getElementById('filtroEstado');
    const btnAplicarFiltro = document.getElementById('btnAplicarFiltro');
    const enderecosTabelaBody = document.getElementById('enderecosTabelaBody').querySelector('tbody');
    const semEnderecos = document.getElementById('semEnderecos');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const exibicaoInicio = document.getElementById('exibicaoInicio');
    const exibicaoFim = document.getElementById('exibicaoFim');
    const totalRegistros = document.getElementById('totalRegistros');
    const paginacao = document.getElementById('paginacao');
    const searchInputTabela = document.getElementById('searchInputTabela');
    const searchButtonTabela = document.getElementById('searchButtonTabela');
    const saveChangesBar = document.getElementById('saveChangesBar');
    const changesCount = document.getElementById('changesCount');
    const btnSalvarAlteracoes = document.getElementById('btnSalvarAlteracoes');
    const btnCancelarAlteracoes = document.getElementById('btnCancelarAlteracoes');
    const btnLimparPrioridadesTabela = document.getElementById('btnLimparPrioridadesTabela');
    const mapFrameTabela = document.getElementById('mapFrameTabela');
    
    // Modal de notificação
    const notificationModalTabela = new bootstrap.Modal(document.getElementById('notificationModalTabela'));
    const modalTitleTabela = document.getElementById('modalTitleTabela');
    const modalMessageTabela = document.getElementById('modalMessageTabela');
    
    // Variáveis de estado
    let paginaAtual = 1;
    let itensPorPagina = 50;
    let totalPaginas = 0;
    let enderecosFiltrados = [];
    let enderecosPaginados = [];
    let filtrosAplicados = {};
    let alteracoesPendentes = {};
    let enderecoOriginal = {};
    
    // Função para mostrar notificação
    function mostrarNotificacao(titulo, mensagem) {
        modalTitleTabela.textContent = titulo;
        modalMessageTabela.textContent = mensagem;
        notificationModalTabela.show();
    }
    
    // Função para mostrar/esconder overlay de carregamento
    function toggleLoading(show) {
        if (show) {
            loadingOverlay.style.display = 'flex';
        } else {
            loadingOverlay.style.display = 'none';
        }
    }
    
    // Função para carregar endereços com base nos filtros
    function carregarEnderecos(pagina = 1) {
        toggleLoading(true);
        
        // Preparar dados para enviar
        const dados = {
            filtro: filtrosAplicados,
            pagina: pagina,
            itens_por_pagina: itensPorPagina
        };
        
        fetch('/get_enderecos_tabela', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao carregar dados');
            }
            return response.json();
        })
        .then(data => {
            enderecosFiltrados = data.enderecos;
            paginaAtual = data.pagina_atual;
            totalPaginas = data.paginas;
            
            // Atualizar informações de paginação
            exibicaoInicio.textContent = ((paginaAtual - 1) * itensPorPagina) + 1;
            exibicaoFim.textContent = Math.min(paginaAtual * itensPorPagina, data.total);
            totalRegistros.textContent = data.total;
            
            // Renderizar tabela
            renderizarTabela(enderecosFiltrados);
            
            // Renderizar paginação
            renderizarPaginacao(paginaAtual, totalPaginas);
            
            // Esconder overlay
            toggleLoading(false);
            
            // Exibir mensagem se não houver resultados
            if (enderecosFiltrados.length === 0) {
                semEnderecos.classList.remove('d-none');
                enderecosTabelaBody.classList.add('d-none');
            } else {
                semEnderecos.classList.add('d-none');
                enderecosTabelaBody.classList.remove('d-none');
            }
        })
        .catch(error => {
            console.error('Erro ao carregar endereços:', error);
            mostrarNotificacao('Erro', 'Não foi possível carregar os endereços.');
            toggleLoading(false);
        });
    }
    
    // Função para renderizar a tabela
    function renderizarTabela(enderecos) {
        // Limpar tabela
        enderecosTabelaBody.innerHTML = '';
        
        // Criar registros da tabela
        enderecos.forEach(endereco => {
            const tr = document.createElement('tr');
            
            // Coluna Cidade
            const tdCidade = document.createElement('td');
            tdCidade.textContent = endereco.cidade;
            
            // Coluna Estado
            const tdEstado = document.createElement('td');
            tdEstado.textContent = endereco.estado;
            
            // Coluna Endereço
            const tdEndereco = document.createElement('td');
            tdEndereco.textContent = endereco.endereco;
            
            // Coluna Prioridade
            const tdPrioridade = document.createElement('td');
            tdPrioridade.classList.add('text-center');
            
            // Input para prioridade
            const inputPrioridade = document.createElement('input');
            inputPrioridade.type = 'number';
            inputPrioridade.className = 'form-control form-control-sm priority-input mx-auto';
            inputPrioridade.placeholder = '-';
            
            // Se já tiver prioridade, preencher o campo
            if (endereco.prioridade !== null) {
                inputPrioridade.value = endereco.prioridade;
                
                // Aplicar cores baseadas na prioridade
                const prioridade = parseInt(endereco.prioridade);
                if (prioridade === 1) {
                    inputPrioridade.classList.add('border-danger', 'text-danger', 'fw-bold');
                } else if (prioridade >= 2 && prioridade <= 3) {
                    inputPrioridade.classList.add('border-warning', 'text-warning');
                } else {
                    inputPrioridade.classList.add('border-info', 'text-info');
                }
            }
            
            // Salvar o valor original para detectar mudanças
            const enderecoCodificado = `${endereco.cidade}||${endereco.estado}||${endereco.endereco}`;
            enderecoOriginal[enderecoCodificado] = endereco.prioridade;
            
            // Event listener para mudanças no input
            inputPrioridade.addEventListener('change', function() {
                const valor = this.value.trim();
                
                // Validar valor (deve ser um número ou vazio)
                if (valor !== '') {
                    const num = parseInt(valor);
                    if (isNaN(num)) {
                        mostrarNotificacao('Erro', 'Prioridade deve ser um número válido');
                        // Restaurar valor anterior
                        this.value = endereco.prioridade !== null ? endereco.prioridade : '';
                        return;
                    }
                    
                    // Registrar a alteração
                    if (num !== endereco.prioridade) {
                        alteracoesPendentes[enderecoCodificado] = num;
                        atualizarBarraSalvar();
                        
                        // Atualizar a classe de cor
                        inputPrioridade.className = 'form-control form-control-sm priority-input mx-auto';
                        if (num === 1) {
                            inputPrioridade.classList.add('border-danger', 'text-danger', 'fw-bold');
                        } else if (num >= 2 && num <= 3) {
                            inputPrioridade.classList.add('border-warning', 'text-warning');
                        } else {
                            inputPrioridade.classList.add('border-info', 'text-info');
                        }
                    }
                } else {
                    // Registrar como "remover prioridade" (não implementado ainda)
                    mostrarNotificacao('Atenção', 'Deixar o campo em branco não remove a prioridade.');
                    // Restaurar valor anterior
                    this.value = endereco.prioridade !== null ? endereco.prioridade : '';
                }
            });
            
            // Adicionar o input à célula
            tdPrioridade.appendChild(inputPrioridade);
            
            // Adicionar células à linha
            tr.appendChild(tdCidade);
            tr.appendChild(tdEstado);
            tr.appendChild(tdEndereco);
            tr.appendChild(tdPrioridade);
            
            // Adicionar linha ao corpo da tabela
            enderecosTabelaBody.appendChild(tr);
        });
    }
    
    // Função para renderizar a paginação
    function renderizarPaginacao(paginaAtual, totalPaginas) {
        paginacao.innerHTML = '';
        
        // Botão Anterior
        const liAnterior = document.createElement('li');
        liAnterior.className = `page-item ${paginaAtual === 1 ? 'disabled' : ''}`;
        
        const aAnterior = document.createElement('a');
        aAnterior.className = 'page-link';
        aAnterior.href = '#';
        aAnterior.innerHTML = '&laquo;';
        aAnterior.setAttribute('aria-label', 'Anterior');
        
        aAnterior.addEventListener('click', function(e) {
            e.preventDefault();
            if (paginaAtual > 1) {
                carregarEnderecos(paginaAtual - 1);
            }
        });
        
        liAnterior.appendChild(aAnterior);
        paginacao.appendChild(liAnterior);
        
        // Determinar quais páginas mostrar
        let startPage = Math.max(1, paginaAtual - 2);
        let endPage = Math.min(totalPaginas, startPage + 4);
        
        // Ajustar o início se estamos perto do final
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        
        // Renderizar números de página
        for (let i = startPage; i <= endPage; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${i === paginaAtual ? 'active' : ''}`;
            
            const a = document.createElement('a');
            a.className = 'page-link';
            a.href = '#';
            a.textContent = i;
            
            a.addEventListener('click', function(e) {
                e.preventDefault();
                carregarEnderecos(i);
            });
            
            li.appendChild(a);
            paginacao.appendChild(li);
        }
        
        // Botão Próximo
        const liProximo = document.createElement('li');
        liProximo.className = `page-item ${paginaAtual === totalPaginas ? 'disabled' : ''}`;
        
        const aProximo = document.createElement('a');
        aProximo.className = 'page-link';
        aProximo.href = '#';
        aProximo.innerHTML = '&raquo;';
        aProximo.setAttribute('aria-label', 'Próximo');
        
        aProximo.addEventListener('click', function(e) {
            e.preventDefault();
            if (paginaAtual < totalPaginas) {
                carregarEnderecos(paginaAtual + 1);
            }
        });
        
        liProximo.appendChild(aProximo);
        paginacao.appendChild(liProximo);
    }
    
    // Função para atualizar a barra de salvamento
    function atualizarBarraSalvar() {
        const totalAlteracoes = Object.keys(alteracoesPendentes).length;
        
        if (totalAlteracoes > 0) {
            changesCount.textContent = totalAlteracoes;
            saveChangesBar.style.display = 'block';
        } else {
            saveChangesBar.style.display = 'none';
        }
    }
    
    // Event listener para o botão de aplicar filtro
    btnAplicarFiltro.addEventListener('click', function() {
        // Verificar se há alterações pendentes antes de mudar de página
        if (Object.keys(alteracoesPendentes).length > 0) {
            if (confirm('Existem alterações não salvas. Deseja salvá-las antes de aplicar os filtros?')) {
                salvarAlteracoes();
            } else {
                // Limpar alterações pendentes
                alteracoesPendentes = {};
                atualizarBarraSalvar();
            }
        }
        
        // Obter valores dos filtros
        const cidade = filtroCidade.value;
        const estado = filtroEstado.value;
        
        // Aplicar filtros
        filtrosAplicados = {};
        if (cidade) filtrosAplicados.cidade = cidade;
        if (estado) filtrosAplicados.estado = estado;
        
        // Resetar paginação
        paginaAtual = 1;
        
        // Carregar endereços com os novos filtros
        carregarEnderecos(paginaAtual);
    });
    
    // Event listener para o botão de pesquisa
    searchButtonTabela.addEventListener('click', function() {
        const termo = searchInputTabela.value.trim().toLowerCase();
        
        if (termo) {
            // Redirecionar para a página de mapa com o termo de pesquisa como query
            // Isso abre uma nova visualização com os resultados da pesquisa
            fetch('/pesquisar_enderecos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ termo_pesquisa: termo })
            })
            .then(response => response.json())
            .then(data => {
                // Atualizar iframe do mapa
                if (data.mapa_url) {
                    mapFrameTabela.src = data.mapa_url + '?' + new Date().getTime(); // Evitar cache
                }
                
                // Mostrar notificação sobre resultados
                if (data.total_resultados === 0) {
                    mostrarNotificacao('Pesquisa', 'Nenhum endereço encontrado com o termo: ' + termo);
                } else {
                    const mensagem = data.total_resultados === 1 ? 
                        '1 endereço encontrado' : 
                        `${data.total_resultados} endereços encontrados`;
                    
                    mostrarNotificacao('Pesquisa', `${mensagem} para "${termo}". O mapa foi atualizado.`);
                }
            })
            .catch(error => {
                console.error('Erro ao pesquisar endereços:', error);
                mostrarNotificacao('Erro', 'Ocorreu um erro ao pesquisar endereços.');
            });
        }
    });
    
    // Event listener para pesquisar ao pressionar Enter
    searchInputTabela.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchButtonTabela.click();
        }
    });
    
    // Função para salvar alterações
    function salvarAlteracoes() {
        if (Object.keys(alteracoesPendentes).length === 0) {
            mostrarNotificacao('Atenção', 'Não há alterações para salvar.');
            return;
        }
        
        toggleLoading(true);
        
        // Preparar dados para enviar
        const prioridadesParaSalvar = [];
        
        for (const enderecoCodificado in alteracoesPendentes) {
            const [cidade, estado, endereco] = enderecoCodificado.split('||');
            
            prioridadesParaSalvar.push({
                cidade: cidade,
                estado: estado,
                endereco: endereco,
                prioridade: alteracoesPendentes[enderecoCodificado]
            });
        }
        
        // Enviar dados para o backend
        fetch('/salvar_prioridades_tabela', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prioridades: prioridadesParaSalvar })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao salvar prioridades');
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                mostrarNotificacao('Sucesso', data.message);
                
                // Atualizar o mapa
                if (data.mapa_url) {
                    mapFrameTabela.src = data.mapa_url + '?' + new Date().getTime(); // Evitar cache
                }
                
                // Limpar alterações pendentes
                alteracoesPendentes = {};
                atualizarBarraSalvar();
                
                // Atualizar a tabela para refletir as mudanças
                carregarEnderecos(paginaAtual);
            } else {
                mostrarNotificacao('Erro', data.message || 'Erro ao salvar prioridades');
            }
            
            toggleLoading(false);
        })
        .catch(error => {
            console.error('Erro ao salvar prioridades:', error);
            mostrarNotificacao('Erro', 'Ocorreu um erro ao tentar salvar as prioridades.');
            toggleLoading(false);
        });
    }
    
    // Event listener para o botão de salvar alterações
    btnSalvarAlteracoes.addEventListener('click', salvarAlteracoes);
    
    // Event listener para o botão de cancelar alterações
    btnCancelarAlteracoes.addEventListener('click', function() {
        if (confirm('Tem certeza que deseja cancelar todas as alterações?')) {
            alteracoesPendentes = {};
            atualizarBarraSalvar();
            carregarEnderecos(paginaAtual);
        }
    });
    
    // Event listener para o botão de limpar prioridades
    btnLimparPrioridadesTabela.addEventListener('click', function() {
        if (confirm('Tem certeza que deseja limpar TODAS as prioridades? Esta ação não pode ser desfeita.')) {
            toggleLoading(true);
            
            fetch('/limpar_preferencias', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    mostrarNotificacao('Sucesso', data.message || 'Lista de prioridades limpa com sucesso!');
                    
                    // Atualizar o mapa
                    if (data.mapa_url) {
                        mapFrameTabela.src = data.mapa_url + '?' + new Date().getTime(); // Evitar cache
                    }
                    
                    // Limpar alterações pendentes
                    alteracoesPendentes = {};
                    atualizarBarraSalvar();
                    
                    // Recarregar dados
                    carregarEnderecos(paginaAtual);
                } else {
                    mostrarNotificacao('Erro', data.message || 'Erro ao limpar lista de prioridades.');
                }
                
                toggleLoading(false);
            })
            .catch(error => {
                console.error('Erro ao limpar prioridades:', error);
                mostrarNotificacao('Erro', 'Ocorreu um erro ao tentar limpar a lista de prioridades.');
                toggleLoading(false);
            });
        }
    });
    
    // Carregar endereços ao carregar a página
    carregarEnderecos();
});