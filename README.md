# Baixa Rápida

App leve (PWA) para preencher a **baixa de insumos** e as **transferências** no celular e enviar pro WhatsApp.

- **Baixa:** escolhe Ferti 1/2 e a data, toca nos produtos, preenche Consumo / Transferência / Quant. / Devolução. Envia a **imagem da tabela** (igual à planilha do Excel) pelo WhatsApp.
- **Transferência:** Saldo ant., Qtde transf., Estoque, Destino, Devolução + fotos (cada foto sai com o nome do produto escrito no topo). Texto no modelo da mensagem que já circula.
- Guarda no aparelho primeiro (localStorage; fotos em IndexedDB) e, com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (mesmo Supabase do SPA), sobe pra nuvem com fila quando tem sinal: Ferti 1/2 → `adubacao_baixa_diaria` (a "Baixa do dia" do sistema), Pulverização → `pulverizacao_baixa_diaria`, Transferências → `adubacao_transferencias`, fotos → Storage `fotos-insumos` (`src/lib/nuvem.js`). Sem as variáveis, funciona só no aparelho. Sem login.
- Lista de produtos: `src/data/produtos.js` (dá pra criar produto novo direto na tela).

Rodar: `npm install && npm run dev` · Build: `npm run build`
