 Plano: Integração com IA (Groq) — Assistente de Escrita de Laudos                                                                                 

 Contexto

 O projeto já possui editor de laudos multi-seção com TinyMCE, placeholders e preview PDF. O PRD (migracao/PRD.md) prevê a funcionalidade FR7:
 Assistente IA com revisão gramatical, adequação de tom formal técnico e descrição de imagens. A integração será feita primeiro com a API Groq
 (rápida, compatível com OpenAI, suporta modelos de visão).

 Problema

 Atualmente o perito escreve o laudo manualmente seção por seção, sem assistência de IA. Isso consome tempo e pode gerar inconsistências de tom ou
 erros ortográficos. O objetivo é adicionar botões de ação da IA em cada seção do editor para:
 - Revisar ortografia ignorando placeholders
 - Reescrever o texto em tom formal pericial
 - Descrever imagens inseridas no texto
 - Perguntar livremente à IA

 Abordagem Recomendada

 Ponto único de escolha do modelo de IA

 Toda a decisão de qual provedor e modelo de IA será usado acontece exclusivamente na página ModelosIAPage.tsx. O perito escolhe o
 provedor e o modelo nessa página — essa escolha é persistida na tabela configuracoes e lida pelo backend a cada chamada. Nenhum outro
 ponto do sistema (toolbar, sheet, editor) expõe ou toma essa decisão; eles apenas disparam ações de IA sem saber qual provedor está
 configurado.

 Segurança da Chave de API

 A chave da API Groq será armazenada na tabela configuracoes (chave-valor) e as chamadas HTTP serão feitas pelo processo main do Electron, nunca
 pelo renderer. Isso evita expor a chave no frontend. O renderer envia o prompt/conteúdo via IPC; o main chama a API e retorna a resposta.

 Interface por Seção

 Cada seção do editor (Collapsible no LaudosPage) receberá uma barra de ferramentas de IA com 3 botões fixos e 1 campo livre:
 1. Ortografia — prompt fixo para revisão gramatical
 2. Adequar Escrita — prompt fixo para reescrever em tom pericial formal
 3. Descrever Imagem — extrai imagens do HTML da seção, envia para modelo de visão
 4. Perguntar — campo de texto livre com botão enviar

 A interação de pergunta/resposta será feita em um Sheet (painel lateral deslizante do shadcn/ui), preservando o contexto da conversa por seção. As
 respostas da IA podem ser aplicadas ao editor com um botão "Usar este texto".

 Página de Configuração

 Nova página "Modelos IA" dentro da seção Configurações do menu, com:
 - Campo para chave de API Groq (Input, tipo password)
 - Select para modelo padrão (ex: llama-3.3-70b, llama-3.2-11b-vision)
 - Toggle para habilitar/desabilitar IA
 - Botão "Testar conexão"

 Arquivos Críticos

 Novos (a criar)

 - src/renderer/pages/ModelosIAPage.tsx — Página de configuração de IA
 - src/renderer/components/ai/AISheet.tsx — Painel lateral de chat com IA
 - src/renderer/components/ai/AISectionToolbar.tsx — Barra de botões de IA por seção
 - src/main/ipc/handlers/ia.handlers.ts — Handlers IPC para chamar API Groq

 Alterações em existentes

 - src/renderer/App.tsx — Adicionar rota /modelos-ia e lazy import
 - src/renderer/components/layout/AppSidebar.tsx — Adicionar "Modelos IA" em Configurações
 - src/renderer/pages/LaudosPage.tsx — Integrar AISectionToolbar em cada seção Collapsible
 - src/main/ipc/index.ts — Registrar registerIAHandlers()
 - src/preload/index.ts — Adicionar ia ao IpcAPI (com canais no ALLOWED_CHANNELS)
 - package.json — Adicionar dependência groq (SDK) ou usar fetch nativo

 Reutilização existente

 - window.ipcAPI.configuracao.obter/salvar — persistir chave API e modelo
 - Dialog, Sheet, Input, Textarea, Button, Select, Badge — UI shadcn
 - TinyMceEditor com editorId — identificar conteúdo por seção

 Implementação Detalhada

 Passo 1: Infraestrutura IPC + Serviço Groq (Main Process)

 src/main/ipc/handlers/ia.handlers.ts (novo)
 - Canal ia:revisarOrtografia — recebe texto HTML, extrai texto puro (ignorando spans de placeholder), chama Groq com prompt fixo, retorna texto
 revisado
 - Canal ia:adequarEscrita — mesmo fluxo, prompt diferente para tom pericial
 - Canal ia:descreverImagem — recebe array de URLs base64/data-URI de imagens do HTML, chama modelo de visão Groq (llama-3.2-11b-vision-preview)
 - Canal ia:perguntar — recebe pergunta + contexto (texto da seção), retorna resposta

 Cada handler:
 1. Busca chave API via configuracaoService.obter('api_key_groq')
 2. Se não houver chave, retorna erro amigável
 3. Chama https://api.groq.com/openai/v1/chat/completions via fetch
 4. Retorna { success, data: respostaTexto } ou { success: false, error }

 src/main/ipc/index.ts
 - Adicionar import { registerIAHandlers } from './handlers/ia.handlers.js'
 - Adicionar registerIAHandlers() no setup

 src/preload/index.ts
 - Adicionar ao IpcAPI:
 ia: {
   revisarOrtografia: (texto: string) => Promise<...>;
   adequarEscrita: (texto: string) => Promise<...>;
   descreverImagem: (imagensBase64: string[]) => Promise<...>;
   perguntar: (pergunta: string, contexto: string) => Promise<...>;
 }
 - Adicionar canais ao ALLOWED_CHANNELS

 Passo 2: Página de Configuração Modelos IA

 src/renderer/pages/ModelosIAPage.tsx (novo)

 Layout padrão do projeto (container, Card, Form shadcn):
 - Card 1 — Configuração Groq
   - Input "Chave de API Groq" (type="password", com botão olho para revelar)
   - Select "Modelo Padrão" com opções: llama-3.3-70b-versatile, llama-3.2-11b-vision-preview, gemma2-9b-it, mixtral-8x7b-32768
   - Botão "Salvar configurações" — persiste via configuracao.salvar('api_key_groq', ...) e configuracao.salvar('modelo_ia_padrao', ...)
   - Botão "Testar conexão" — chama ia:perguntar com "Olá, responda apenas 'OK'" para validar chave
   - Alert de sucesso/erro com variant="destructive" ou classes dark:
 - Card 2 — Instruções
   - Texto explicativo sobre como obter chave em console.groq.com
   - Aviso de segurança: "A chave é armazenada localmente no banco SQLite criptografado"

 Rota: /modelos-ia

 Passo 3: Barra de Ferramentas de IA por Seção

 src/renderer/components/ai/AISectionToolbar.tsx (novo)

 Props:
 interface Props {
   editorId: string;        // ex: "secao-0"
   secaoIndex: number;      // índice da seção
   laudoId: string;
   onApplyText: (texto: string) => void;  // callback para substituir conteúdo no editor
 }

 UI: Barra horizontal com 4 elementos:
 1. Botão "Ortografia" (ícone SpellCheck do lucide) — chama ia:revisarOrtografia com conteúdo atual
 2. Botão "Adequar" (ícone PenLine) — chama ia:adequarEscrita
 3. Botão "Descrever Imagem" (ícone Image) — desabilitado se não houver <img> no HTML; extrai src das imagens
 4. Campo de texto livre (Input compacto) + botão "Enviar" (ícone Send) — abre/expande o Sheet de chat

 Estados:
 - loading — mostra spinner no botão ativo
 - error — Alert inline na toolbar

 Passo 4: Sheet de Chat com IA

 src/renderer/components/ai/AISheet.tsx (novo)

 Props:
 interface Props {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   secaoTitulo: string;
   editorId: string;
   onApplyResponse: (texto: string) => void;
 }

 UI — Sheet lateral (lado direito, side="right", w-[420px]):
 - Header: Título "Assistente IA — {secaoTitulo}" + Badge indicando status (conectando/online/erro)
 - Área de mensagens: Scroll com balões estilo chat (mensagens do usuário à direita, da IA à esquerda)
 - Área de resposta da IA: Quando uma resposta chega, mostra botão "Aplicar ao editor" no rodapé do balão da IA
 - Input de pergunta: Textarea no rodapé com botão enviar (Enter envia, Shift+Enter quebra linha)
 - Indicador de streaming: "Pensando..." com dots animados enquanto aguarda resposta

 Cada mensagem é um objeto:
 interface ChatMessage {
   role: 'user' | 'assistant';
   content: string;
   timestamp: number;
 }

 O estado de mensagens é mantido por seção (usando editorId como chave no componente pai).

 Passo 5: Integração no LaudosPage

 src/renderer/pages/LaudosPage.tsx (alterações)

 1. Adicionar estado para o Sheet:
 const [aiSheetOpen, setAiSheetOpen] = useState(false);
 const [aiSheetSecaoIdx, setAiSheetSecaoIdx] = useState<number | null>(null);
 const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({});
 2. Dentro do map de seções, logo acima do ContextMenuTrigger do TinyMCE, inserir <AISectionToolbar ... />
 3. No final do JSX (dentro do TooltipProvider), renderizar <AISheet ... /> condicionalmente quando aiSheetOpen && aiSheetSecaoIdx !== null
 4. Função handleApplyAIResponse(idx, texto) que:
   - Atualiza secoes[idx].conteudo com o texto retornado
   - Chama atualizarConteudoSecao(idx, texto)
   - Fecha o Sheet

 Prompts Fixos (Processo Main)

 Cada handler constrói o prompt apropriado:

 Ortografia:
 Você é um revisor de textos jurídico-periciais. Revisa APENAS a ortografia, gramática e pontuação do texto abaixo. NÃO altere o conteúdo técnico,
 nomes próprios, números de documentos, placeholders {{...}} nem a estrutura do texto. Retorne APENAS o texto revisado, sem comentários.

 Texto:
 {texto}

 Adequar Escrita:
 Você é um perito criminal forense com 20 anos de experiência. Reescreva o texto abaixo em linguagem técnica, formal e objetiva, adequada a um laudo
  pericial oficial da Polícia Científica. Mantenha todos os placeholders {{...}} intactos. Retorne APENAS o texto reescrito.

 Texto:
 {texto}

 Descrever Imagem:
 Você é um perito criminal descrevendo evidências fotográficas para um laudo pericial. Descreva a imagem abaixo de forma técnica, objetiva e
 detalhada, como seria inserida na seção de exames ou constatações de um laudo oficial. Retorne APENAS a descrição.
 - imagens em base64 no formato image_url do Groq API.

 Passo 6: Menu + Rota

 AppSidebar.tsx:
 - Em Configurações > items, adicionar: { title: 'Modelos IA', path: '/modelos-ia', icon: Brain }
 - Importar Brain do lucide-react

 App.tsx:
 - Adicionar lazy import: const ModelosIAPage = lazy(() => import('@/pages/ModelosIAPage').then(m => ({ default: m.ModelosIAPage })));
 - Adicionar rota: <Route path="/modelos-ia" element={<ModelosIAPage />} />

 Decisões de UX

 1. Botões fixos vs dropdown: 3 botões visíveis + input livre — mais rápido que menu dropdown para ações repetitivas
 2. Sheet lateral vs Dialog: Sheet mantém o editor visível ao lado, permitindo referência cruzada
 3. Aplicar ao editor: Resposta da IA não é aplicada automaticamente — usuário vê primeiro e decide, evitando sobreposição acidental
 4. Placeholders preservados: Todos os prompts instruem a IA a não tocar em {{...}}
 5. Imagens base64: Extraídas do HTML da seção via DOMParser (querySelectorAll('img')), convertidas para data-URI se necessário
 6. Streaming: Respostas da IA são recebidas de uma só vez (não streaming) para simplificar IPC. Se necessário, evoluir para streaming chunkado no
 futuro.

 Verificação

 Build e Lint

 npm run build       # compilação completa
 npm run lint        # sem novos warnings

 Testes Manuais

 1. Abrir Configurações → Modelos IA
 2. Inserir chave de API Groq (válida)
 3. Clicar "Testar conexão" → deve retornar sucesso
 4. Salvar configuração → recarregar página → chave deve persistir
 5. Ir para Laudos → editar um laudo
 6. Cada seção do editor deve mostrar a barra de ferramentas de IA
 7. Clicar "Ortografia" → aguardar resposta → clicar "Aplicar"
 8. Verificar que placeholders {{...}} não foram alterados
 9. Inserir imagem no editor → clicar "Descrever Imagem"
 10. Usar campo livre para perguntar → ver chat no Sheet
 11. Testar com chave inválida → mensagem de erro amigável
 12. Verificar tema dark — todos os componentes shadcn devem adaptar

 Cenários de Erro

 - Sem chave API configurada → botões de IA desabilitados com tooltip "Configure sua chave em Configurações → Modelos IA"
 - API retorna erro (rate limit, chave inválida) → Alert inline na toolbar ou no Sheet
 - Timeout na chamada → mensagem "Serviço indisponível, tente novamente"
 - Sem imagem na seção → botão "Descrever Imagem" desabilitado