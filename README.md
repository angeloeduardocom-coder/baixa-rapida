# Baixa Rápida

App leve (PWA) para preencher a **baixa de insumos** e as **transferências** no celular e enviar pro WhatsApp.

- **Baixa:** escolhe Ferti 1/2 e a data, toca nos produtos, preenche Consumo / Transferência / Quant. / Devolução. Envia a **imagem da tabela** (igual à planilha do Excel) pelo WhatsApp.
- **Transferência:** Saldo ant., Qtde transf., Estoque, Destino, Devolução + fotos (cada foto sai com o nome do produto escrito no topo). Texto no modelo da mensagem que já circula.
- Guarda no aparelho primeiro (localStorage; fotos em IndexedDB) e, com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (mesmo Supabase do SPA), sobe pra nuvem com fila quando tem sinal: Ferti 1/2 → `adubacao_baixa_diaria` (a "Baixa do dia" do sistema), Pulverização → `pulverizacao_baixa_diaria`, Transferências → `adubacao_transferencias`, fotos → Storage `fotos-insumos` (`src/lib/nuvem.js`). Sem as variáveis, funciona só no aparelho. Sem login.
- Lista de produtos: `src/data/produtos.js` (dá pra criar produto novo direto na tela).

Rodar: `npm install && npm run dev` · Build: `npm run build`

## Tela inicial por função (28/10/2026)
- O login agora começa com 3 entradas: **Gestor**, **Auxiliar de campo** e **Aplicações**. Aplicações abre a lista dos campos (Ferti 1, Ferti 2, Pulverização); depois vem nome e senha.
- Perfis e senhas não mudaram (`PERFIS_APP`, senhas do SPA e logins individuais). Os grupos ficam em `GRUPOS_APP` (`src/lib/sessao.js`); os aplicadores por método entram na lista de Aplicações quando cada um for montado.
- **Aplicadores por método** (28/10/2026): dentro de Aplicações entram Tratorizado, Drone, Costal, Esquicho, Lança e Polvilhado (perfis `apl_*` em `PERFIS_APP`, senhas padrão `tratorizado123`, `drone123`...). Por enquanto veem só a programação do dia; cada um será estruturado depois. Os perfis também estão em Senhas e logins do SPA.
- **Programação por método** (28/10/2026): o aplicador vê só os baldes do método dele (o app manda `&metodo=` para a programação do SPA).
- **Área do caldeiro** (28/10/2026): o perfil Pulverização (`pulv`) aparece com esse nome no login e no topo do app (pedidos, requisições e baixas). Senha e permissões iguais.
- O botão **Operação em campo** passou a se chamar **Programação do dia** (28/10/2026).
- **Aviso só com mudança de verdade** (28/10/2026): Baixa e Transferências só notificam se o conteúdo mudou desde o último aviso daquele assunto (`mudouDesdeUltimoAviso`/`lembrarAviso` em `avisosNuvem.js`). Salvar igual de novo não avisa ninguém.
- **Qtde programada × Qtde transf.** (28/10/2026): na transferência fechado → aberto, o Pedido do fechado preenche **Qtde programada** (o que a programação pede); **Qtde transf. (estoque)** fica vazia para o pessoal do estoque preencher. Texto do WhatsApp, histórico e PDF mostram as duas.
- Pedido do fechado com produto que já está na lista: atualiza a Qtde programada; item antigo (número da programação em Qtde transf.) passa o número pro campo certo, sem apagar o que o estoque digitou.
- **Aplicador (Drone etc.)** (28/10/2026): duas abas — **Programação** (só os baldes do método, botão "Não aplicado" com motivo, lista do que não foi aplicado com Desfazer, e **Anotações do dia** que avisam o Gestor) e **Requisição** (a folha do método; Salvar avisa só o Gestor). Anotações ficam na tabela `avisos` com tag `anotacao:<método>:<data>:<id>`.
