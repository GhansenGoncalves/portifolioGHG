# 🍰 Doce Pote — Sistema de gestão de bolo no pote

Sistema web funcional para gerir todo o fluxo de vendas de um negócio de bolo
no pote: dashboard com indicadores e gráficos, registro de vendas com carrinho,
catálogo de produtos com controle de estoque, promoções aplicadas
automaticamente e dicas geradas a partir dos próprios dados.

## Como usar

Não precisa instalar nada: abra o arquivo `index.html` em qualquer navegador
moderno. Os dados ficam salvos no próprio navegador (localStorage).

Se preferir servir por HTTP:

```bash
npm start   # sobe em http://127.0.0.1:4173
```

Na primeira abertura o sistema carrega **dados de demonstração** (90 dias de
vendas simuladas) para o dashboard já nascer preenchido. Na aba **Dicas** você
pode restaurar a demonstração ou apagar tudo e começar do zero com os seus
próprios produtos.

## Funcionalidades

### 📊 Dashboard
- KPIs do período: receita, nº de vendas, potes vendidos, ticket médio e lucro
  estimado, com comparação contra o período anterior.
- Filtro de período (hoje / 7 / 30 / 90 dias / tudo) que re-escopa todos os
  números e gráficos de uma vez.
- Gráficos interativos (hover com tooltip e visão em tabela): receita por dia,
  top produtos por receita, vendas por dia da semana e formas de pagamento.
- Modo claro e escuro automáticos (segue o tema do sistema).

### 🛒 Vendas
- Carrinho com múltiplos itens, validação de estoque e escolha da forma de
  pagamento (Pix, cartão, dinheiro).
- Promoções vigentes aplicadas **automaticamente** ao adicionar o item.
- Histórico completo, cancelamento de venda com devolução do estoque e
  exportação para CSV.

### 🧁 Produtos
- Cadastro com preço, custo, estoque e margem calculada.
- Alertas visuais de estoque baixo/esgotado e potes vendidos nos últimos 30 dias.

### 🏷️ Promoções
- Desconto percentual ou em reais, por produto ou para todos, com vigência.
- Status automático: ativa, agendada ou expirada.

### 💡 Dicas
- Motor de análise que lê os dados reais e sugere ações: repor estoque de
  sabores em falta, revisar margens apertadas, promover sabores parados,
  aproveitar os melhores dias da semana, aumentar o ticket médio e mais.
- Roteiro de evolução do sistema (fidelidade, WhatsApp, insumos, backup,
  entregas e metas).

## Tecnologia

HTML, CSS e JavaScript puros — sem dependências de runtime, sem build.
Gráficos em SVG feitos à mão, paleta de cores validada para daltonismo e
contraste, dados persistidos em localStorage.

## Testes automatizados

Suíte E2E com [Playwright](https://playwright.dev) cobrindo os fluxos
principais: dashboard e filtros, venda com promoção automática, validação de
estoque, cancelamento com estorno de estoque, persistência após reload,
exportação CSV, CRUD de produtos e promoções, dicas geradas dos dados,
estado vazio e modo escuro.

```bash
npm install
npx playwright install chromium   # primeira vez
npm test
```

Cada teste roda em contexto isolado do navegador (localStorage limpo), então
a aplicação sempre parte dos dados de demonstração — sem dependência de ordem
entre testes.
