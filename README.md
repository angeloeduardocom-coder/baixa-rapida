# Baixa Rápida

App leve (PWA) para preencher a **baixa de insumos** e as **transferências** no celular e enviar pro WhatsApp.

- **Baixa:** escolhe Ferti 1/2 e a data, toca nos produtos, preenche Consumo / Transferência / Quant. / Devolução. Envia a **imagem da tabela** (igual à planilha do Excel) pelo WhatsApp.
- **Transferência:** Saldo ant., Qtde transf., Estoque, Destino, Devolução + fotos (cada foto sai com o nome do produto escrito no topo). Texto no modelo da mensagem que já circula.
- Tudo fica guardado no aparelho (localStorage; fotos em IndexedDB). Funciona sem sinal. Sem login.
- Lista de produtos: `src/data/produtos.js` (dá pra criar produto novo direto na tela).

Rodar: `npm install && npm run dev` · Build: `npm run build`
