/* Testes E2E do Doce Pote.
   Cada teste roda em contexto isolado (localStorage limpo), então a aplicação
   sempre parte dos dados de demonstração: 6 produtos, 90 dias de vendas e
   2 promoções (uma ativa para "Ninho com Nutella", uma expirada). */
"use strict";

const { test, expect } = require("@playwright/test");

async function openApp(page) {
  await page.goto("/");
  await expect(page.locator("#kpi-row .kpi")).toHaveCount(5);
}

async function goTo(page, view) {
  await page.click(`.tab[data-view="${view}"]`);
  await expect(page.locator(`#view-${view}`)).toBeVisible();
}

/* Seleciona um produto no combo de venda pelo nome. */
async function pickProduct(page, name) {
  const value = await page.$$eval(
    "#sale-product option",
    (opts, wanted) => opts.find((o) => o.textContent.includes(wanted))?.value,
    name,
  );
  expect(value, `produto "${name}" deveria estar no combo`).toBeTruthy();
  await page.selectOption("#sale-product", value);
}

/* Lê o estoque exibido no catálogo para um produto. */
async function stockOf(page, name) {
  await goTo(page, "produtos");
  const row = page.locator("#products-table tbody tr", { hasText: name });
  const badge = await row.locator("td").nth(4).textContent();
  const match = badge.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

test.describe("Dashboard", () => {
  test("carrega KPIs e os quatro gráficos com dados de demonstração", async ({ page }) => {
    await openApp(page);
    await expect(page.locator("#kpi-row .kpi .label")).toHaveText([
      "Receita", "Vendas", "Potes vendidos", "Ticket médio", "Lucro estimado",
    ]);
    await expect(page.locator("#revenue-chart svg")).toBeVisible();
    expect(await page.locator("#top-products-chart .hbar-row").count()).toBeGreaterThan(0);
    await expect(page.locator("#weekday-chart .col-slot")).toHaveCount(7);
    expect(await page.locator("#payment-chart .stack-seg").count()).toBeGreaterThan(0);
    // Legenda presente na barra de pagamentos (múltiplas séries)
    expect(await page.locator("#payment-chart .legend .key").count()).toBeGreaterThan(1);
  });

  test("filtro de período re-escopa os números", async ({ page }) => {
    await openApp(page);
    const revenue30 = await page.locator("#kpi-row .kpi .value").first().textContent();
    await page.click('#range-filters .chip[data-days="7"]');
    await expect(page.locator('#range-filters .chip[data-days="7"]')).toHaveClass(/active/);
    const revenue7 = await page.locator("#kpi-row .kpi .value").first().textContent();
    expect(revenue7).not.toBe(revenue30);
    await expect(page.locator("#revenue-chart-sub")).toHaveText("Últimos 7 dias");
  });

  test("gráfico de linha mostra tooltip com crosshair no hover", async ({ page }) => {
    await openApp(page);
    const box = await page.locator("#revenue-chart svg").boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await expect(page.locator("#tooltip")).toBeVisible();
    await expect(page.locator("#tooltip")).toContainText("receita");
  });

  test("todo gráfico oferece visão em tabela", async ({ page }) => {
    await openApp(page);
    await page.locator("#view-dashboard details summary").first().click();
    expect(await page.locator("#revenue-table table tbody tr").count()).toBeGreaterThan(0);
  });
});

test.describe("Fluxo de venda", () => {
  test("registra venda com promoção aplicada automaticamente", async ({ page }) => {
    await openApp(page);
    await goTo(page, "vendas");
    // "Semana do Ninho" (10% em Ninho com Nutella, R$ 17,00) está ativa no seed
    await pickProduct(page, "Ninho com Nutella");
    await page.fill("#sale-qty", "2");
    await page.click("#btn-add-cart");

    await expect(page.locator("#cart-table tbody tr")).toHaveCount(1);
    await expect(page.locator(".promo-tag")).toContainText("Semana do Ninho");
    await expect(page.locator("#cart-discount")).toHaveText("−R$ 3,40");
    await expect(page.locator("#cart-total")).toHaveText("R$ 30,60");

    // O histórico na tela é limitado às 100 vendas mais recentes; a inserção
    // é conferida direto nos dados persistidos.
    const countSales = () => page.evaluate(
      () => JSON.parse(localStorage.getItem("docepote-v1")).sales.length,
    );
    const salesBefore = await countSales();
    await page.click("#btn-confirm-sale");
    await expect(page.locator("#toast")).toContainText("Venda registrada: R$ 30,60");
    expect(await countSales()).toBe(salesBefore + 1);
    await expect(
      page.locator("#sales-table tbody tr", { hasText: "2× Ninho com Nutella" }).first(),
    ).toContainText("−R$ 3,40");
    // Carrinho zera após a venda
    await expect(page.locator("#cart-empty")).toBeVisible();
  });

  test("bloqueia venda acima do estoque", async ({ page }) => {
    await openApp(page);
    await goTo(page, "vendas");
    // Prestígio tem apenas 3 no estoque de demonstração
    await pickProduct(page, "Prestígio");
    await page.fill("#sale-qty", "5");
    await page.click("#btn-add-cart");
    await expect(page.locator("#toast")).toContainText("Estoque insuficiente");
    await expect(page.locator("#cart-empty")).toBeVisible();
  });

  /* Cenário controlado: parte do zero e cadastra um produto próprio, para que
     a única venda do histórico seja a criada pelo teste. */
  test("venda baixa o estoque e cancelamento devolve", async ({ page }) => {
    await openApp(page);
    page.on("dialog", (d) => d.accept());
    await goTo(page, "dicas");
    await page.click("#btn-clear-data");
    await goTo(page, "produtos");
    await page.fill("#product-name", "Bolo de Teste");
    await page.fill("#product-price", "10");
    await page.fill("#product-cost", "4");
    await page.fill("#product-stock", "5");
    await page.click('#product-form button[type="submit"]');

    await goTo(page, "vendas");
    await pickProduct(page, "Bolo de Teste");
    await page.fill("#sale-qty", "2");
    await page.click("#btn-add-cart");
    await page.click("#btn-confirm-sale");
    await expect(page.locator("#toast")).toContainText("Venda registrada");
    expect(await stockOf(page, "Bolo de Teste")).toBe(3);

    await goTo(page, "vendas");
    await expect(page.locator("#sales-table tbody tr")).toHaveCount(1);
    await page.locator("#sales-table tbody tr").getByRole("button", { name: "Cancelar" }).click();
    await expect(page.locator("#sales-table tbody tr")).toContainText("Cancelada");
    expect(await stockOf(page, "Bolo de Teste")).toBe(5);
  });

  test("vendas persistem após recarregar a página", async ({ page }) => {
    await openApp(page);
    page.on("dialog", (d) => d.accept());
    await goTo(page, "dicas");
    await page.click("#btn-clear-data");
    await goTo(page, "produtos");
    await page.fill("#product-name", "Bolo Persistente");
    await page.fill("#product-price", "12");
    await page.fill("#product-cost", "5");
    await page.fill("#product-stock", "4");
    await page.click('#product-form button[type="submit"]');

    await goTo(page, "vendas");
    await pickProduct(page, "Bolo Persistente");
    await page.click("#btn-add-cart");
    await page.click("#btn-confirm-sale");
    await expect(page.locator("#toast")).toContainText("Venda registrada");

    await page.reload();
    await goTo(page, "vendas");
    await expect(page.locator("#sales-table tbody tr")).toHaveCount(1);
    await expect(page.locator("#sales-table tbody tr")).toContainText("Bolo Persistente");
  });

  test("exporta o histórico em CSV", async ({ page }) => {
    await openApp(page);
    await goTo(page, "vendas");
    const downloadPromise = page.waitForEvent("download");
    await page.click("#btn-export-csv");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^vendas-doce-pote-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

test.describe("Produtos", () => {
  test("cadastra, edita e exclui produto", async ({ page }) => {
    await openApp(page);
    page.on("dialog", (d) => d.accept());
    await goTo(page, "produtos");

    await page.fill("#product-name", "Pistache");
    await page.fill("#product-price", "20");
    await page.fill("#product-cost", "9");
    await page.fill("#product-stock", "10");
    await page.click('#product-form button[type="submit"]');
    const row = page.locator("#products-table tbody tr", { hasText: "Pistache" });
    await expect(row).toContainText("R$ 20,00");
    await expect(row).toContainText("55%"); // margem calculada

    await row.getByRole("button", { name: "Editar" }).click();
    await page.fill("#product-price", "22");
    await page.click('#product-form button[type="submit"]');
    await expect(page.locator("#products-table tbody tr", { hasText: "Pistache" })).toContainText("R$ 22,00");

    await page.locator("#products-table tbody tr", { hasText: "Pistache" })
      .getByRole("button", { name: "Excluir" }).click();
    await expect(page.locator("#products-table tbody tr", { hasText: "Pistache" })).toHaveCount(0);
  });

  test("sinaliza estoque esgotado e baixo no catálogo", async ({ page }) => {
    await openApp(page);
    await goTo(page, "produtos");
    await expect(page.locator("#products-table tbody tr", { hasText: "Maracujá" })).toContainText("Esgotado");
    await expect(page.locator("#products-table tbody tr", { hasText: "Prestígio" })).toContainText("baixo");
  });
});

test.describe("Promoções", () => {
  test("promoção criada passa a valer no carrinho", async ({ page }) => {
    await openApp(page);
    await goTo(page, "promocoes");

    await page.fill("#promo-name", "Cenoura em dobro");
    const cenouraValue = await page.$$eval(
      "#promo-product option",
      (opts) => opts.find((o) => o.textContent.includes("Cenoura"))?.value,
    );
    await page.selectOption("#promo-product", cenouraValue);
    await page.selectOption("#promo-type", "percent");
    await page.fill("#promo-value", "20");
    // datas já vêm preenchidas: hoje → +7 dias
    await page.click('#promo-form button[type="submit"]');
    const row = page.locator("#promos-table tbody tr", { hasText: "Cenoura em dobro" });
    await expect(row).toContainText("ativa");

    await goTo(page, "vendas");
    await pickProduct(page, "Cenoura com Chocolate"); // R$ 13,00 → 20% = R$ 2,60
    await page.click("#btn-add-cart");
    await expect(page.locator(".promo-tag")).toContainText("Cenoura em dobro");
    await expect(page.locator("#cart-discount")).toHaveText("−R$ 2,60");
  });

  test("rejeita vigência com fim antes do início", async ({ page }) => {
    await openApp(page);
    await goTo(page, "promocoes");
    await page.fill("#promo-name", "Datas invertidas");
    await page.fill("#promo-value", "10");
    await page.fill("#promo-start", "2026-07-10");
    await page.fill("#promo-end", "2026-07-01");
    await page.click('#promo-form button[type="submit"]');
    await expect(page.locator("#toast")).toContainText("A data final deve ser depois da inicial");
    await expect(page.locator("#promos-table tbody tr", { hasText: "Datas invertidas" })).toHaveCount(0);
  });
});

test.describe("Dicas e dados", () => {
  test("gera dica de estoque esgotado a partir dos dados", async ({ page }) => {
    await openApp(page);
    await goTo(page, "dicas");
    await expect(page.locator("#tips-list .tip", { hasText: "está esgotado" })).toContainText("Maracujá");
    expect(await page.locator("#roadmap-list .tip").count()).toBeGreaterThan(3);
  });

  test("apagar tudo leva ao estado vazio e desabilita a venda", async ({ page }) => {
    await openApp(page);
    page.on("dialog", (d) => d.accept());
    await goTo(page, "dicas");
    await page.click("#btn-clear-data");
    await expect(page.locator("#toast")).toContainText("Dados apagados");

    await goTo(page, "vendas");
    await expect(page.locator("#sale-product")).toBeDisabled();
    await goTo(page, "dashboard");
    await expect(page.locator("#kpi-row .kpi .value").first()).toHaveText("R$ 0,00");
  });

  test("modo escuro segue a preferência do sistema", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await openApp(page);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(13, 13, 13)"); // --page do tema escuro
  });
});
