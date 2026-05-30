# Plano de Validação — Base de Dados → App
> Sessão de trabalho | Sem commits até aprovação tela a tela

---

## Contexto

O template real tem **8 abas** com estrutura diferente do que o app espera hoje.
A validação será feita página a página em localhost antes de qualquer deploy.

**Templates no repositório:**
- `templates/BASE_SEMANAL_VAZIO.xlsx` — em branco, aprovado
- `templates/BASE_SEMANAL_DADOS.xlsx` — preenchido, aprovado

---

## Como rodar o localhost

```bash
# Na pasta do repositório:
python -m http.server 8080

# Acessar em:
http://localhost:8080
```

---

## Problema raiz identificado

O `reader.js` detecta a linha de cabeçalho buscando a primeira linha com ≥ 2 células preenchidas.
O template real tem:

```
Linha 1 → Título (ex: "MAPA DE UNIDADES")
Linha 2 → Exemplos por coluna (ex: "Ex: Bloco 1", "Ex: 1", "Ex: 01", "Selecione ▼")
Linha 3 → Cabeçalhos reais (BLOCO, PAVIMENTO, UNIDADE, CATEGORIA)
```

A linha 2 tem múltiplas células preenchidas e **passa no filtro atual** — o app a trata
como cabeçalho, lendo os dados errados. A fix: detectar linha de cabeçalho por células
**todas em MAIÚSCULAS** (os exemplos têm texto misto, os cabeçalhos são caps).

---

## Etapas de execução

### Etapa 1 — Fix: `reader.js` (detecção de cabeçalho)

**Arquivo:** `js/excel/reader.js`

**O que muda:** lógica do `startRow` — de "primeira linha com ≥ 2 células"
para "primeira linha onde TODAS as células são MAIÚSCULAS".

```js
// Antes
const filled = raw2d[i].filter(v => String(v).trim()).length;
const hasLongCell = raw2d[i].some(v => String(v).trim().length > 55);
if (filled >= 2 && !hasLongCell) { startRow = i; break; }

// Depois
const cells = raw2d[i].filter(v => String(v).trim());
const allCaps = cells.every(v => { const s = String(v).trim(); return s === s.toUpperCase(); });
if (cells.length >= 2 && allCaps) { startRow = i; break; }
```

**Validação:** upload do BASE_SEMANAL_DADOS.xlsx → checar console → todas as
abas devem mostrar contagem correta de registros no status de upload.

---

### Etapa 2 — Fix: `reader.js` (campos da CAPA)

**Arquivo:** `js/excel/reader.js`

**O que muda:** o template novo usa `DATA INÍCIO` (com acento) e `SEMANA` (sem "No").
Verificar que `get()` encontra os campos certos.

Campos a confirmar no `lerCapa`:

| Campo no template | Campo no reader |
|---|---|
| `OBRA` | `get('OBRA', 'NOME')` ✓ |
| `CONSTRUTORA` | `get('CONSTRUTORA')` ✓ |
| `GERENCIADORA` | `get('GERENCIADORA')` ✓ |
| `ENGENHEIRO` | `get('ENGENHEIRO')` ✓ |
| `DATA INÍCIO` | `get('DATA INICIO', 'DATA INÍCIO', 'DATA INI')` ✓ |
| `DATA FIM` | `get('DATA FIM')` — valor vem de fórmula Excel |
| `SEMANA` | `get('SEMANA', 'SEMANA No', 'SEMANA N')` ✓ |
| `AVANÇO DE ENTREGAS` | `get('AVANCO DE ENTREGAS', 'AVANÇO DE ENTREGAS')` — valor vem de fórmula |

> **Atenção:** B9 (DATA FIM) e B10 (SEMANA) são fórmulas no Excel. O SheetJS lê o
> valor em cache (calculado quando o usuário salvou). Se o campo vier vazio, adicionar
> fallback de cálculo no JS.

---

### Etapa 3 — Validação: **Página 0 — Upload**

**Checklist:**
- [ ] Status mostra **8 abas** (CONFIG, CAPA, UNIDADES, VISTORIAS, DELIBERAÇÕES, MFO, PARECER, CHECKLIST)
- [ ] UNIDADES: N registros (sem contar linhas de título/exemplo)
- [ ] VISTORIAS: N registros corretos
- [ ] DELIBERAÇÕES: 10 registros
- [ ] MFO: 8 registros
- [ ] CHECKLIST: 8 registros
- [ ] Sem erros no console do navegador

---

### Etapa 4 — Validação: **Página 1 — Capa**

**Checklist:**
- [ ] Campo OBRA preenchido automaticamente
- [ ] Campo CONSTRUTORA preenchido automaticamente
- [ ] Campo GERENCIADORA preenchido automaticamente
- [ ] Campo ENGENHEIRO preenchido automaticamente
- [ ] DATA INÍCIO preenchida
- [ ] DATA FIM preenchida (valor da fórmula)
- [ ] SEMANA Nº calculado
- [ ] AVANÇO DE ENTREGAS calculado (% unidades aprovadas)

---

### Etapa 5 — Validação: **Página 2 — Mapa de Unidades**

**Checklist:**
- [ ] Blocos aparecem separados (A e B)
- [ ] Pavimentos em ordem decrescente
- [ ] Unidades com cores corretas por categoria
- [ ] Legenda visível (Aprovou / Liberado / Estoque / Restrição)
- [ ] Resumo geral com contagens corretas

---

### Etapa 6 — Validação: **Página 3 — Vistorias**

Colunas que o app precisa ler:
`UNIDADE · DATA VISTORIA · STATUS · MOTIVO REPROVAÇÃO · SEMANA Nº · MÊS`

**Checklist:**
- [ ] KPIs totais corretos (Total, Aprovadas, Reprovadas, NC, Taxas)
- [ ] Gráfico de evolução semanal renderizado (usa SEMANA Nº)
- [ ] Selector de semana funcionando
- [ ] Tabela mensal com dados (usa MÊS)
- [ ] Motivos de reprovação no gráfico horizontal

> **Possível ajuste em `render/vistorias.js`:** confirmar que `getMes` e `getSem`
> encontram as colunas `MÊS` e `SEMANA Nº` no novo formato.

---

### Etapa 7 — Validação: **Página 4 — Parecer**

**Checklist:**
- [ ] Texto do parecer carregado da aba PARECER (célula A3)
- [ ] Pontos Positivos preenchidos (da CAPA)
- [ ] Pontos de Atenção preenchidos (da CAPA)
- [ ] Encaminhamentos preenchidos (da CAPA)

---

### Etapa 8 — Validação: **Página 5 — Deliberações**

Colunas novas:
`DATA CADASTRO · TIPO · DESCRIÇÃO · 1º PRAZO · PRAZO ATUAL · DELTA DIAS · RESPONSÁVEL · STATUS`

**Checklist:**
- [ ] Tabela "Demandas em Aberto" aparece com as 8 colunas
- [ ] Tabela "Concluídas" aparece separada
- [ ] STATUS com badge colorido (Pendente / Em Andamento / Concluído)
- [ ] DELTA DIAS com cor (positivo = laranja, zero = cinza)
- [ ] Datas formatadas em dd/mm/aaaa

> **Possível ajuste em `render/delib.js`:** verificar `WIDE_COLS` para as novas
> colunas DESCRIÇÃO (wide) e TIPO (normal).

---

### Etapa 9 — Validação: **Página 6 — MFO**

Colunas (15):
`DESCRIÇÃO · VALOR ORÇADO · VALOR ATUALIZADO · PAGO · A PAGAR · SALDO DE CONTRATOS · COMPROMETIDO · SALDO ORÇ. NOMINAL · SALDO ORÇ. CORRIGIDO · PREV. FINANCEIRA · CUSTO AO TÉRMINO · DESVIO NOMINAL R$ · DESVIO NOMINAL % · DESVIO CORRIGIDO R$ · DESVIO CORRIGIDO %`

**Checklist:**
- [ ] Tabela renderiza com as 15 colunas (preview mostra as 8 primeiras + "...")
- [ ] Card exibe aviso de "PDF em modo paisagem"
- [ ] Valores monetários formatados (R$ / K / M)
- [ ] Percentuais coloridos (vermelho = negativo)

---

### Etapa 10 — Validação: **Página 7 — Checklist**

Colunas (sem OCULTAR):
`ÁREA / LOCAL · ITEM · 1º PRAZO · PRAZO ATUAL · DELTA · STATUS · RESPONSÁVEL · OBSERVAÇÃO`

**Checklist:**
- [ ] Coluna OCULTAR não aparece na tabela
- [ ] STATUS com badge: OK (verde) · Pendente (laranja) · Atenção (amarelo)
- [ ] 1º PRAZO e PRAZO ATUAL formatados como datas
- [ ] DELTA com cor por valor

---

### Etapa 11 — Validação: **PDF — página a página**

Gerar o PDF com o BASE_SEMANAL_DADOS e validar cada página:

| Página | O que validar |
|---|---|
| Capa | Nome, construtora, gerenciadora, período, avanço % |
| Mapa de Unidades | Tabela por bloco/pavimento, resumo geral |
| Vistorias — Visão Total | KPIs, donuts chart, motivos |
| Vistorias — Mensal | Tabela por mês, gráfico de barras |
| Vistorias — Semanal | Gráfico semanal, linha de performance |
| Parecer | Texto completo, pontos positivos/atenção/encam. |
| Deliberações | Tabela 8 colunas, separação aberto/concluído |
| MFO | **Landscape** — 15 colunas visíveis, valores formatados |
| Checklist | 8 colunas (sem OCULTAR), badges de status |
| Anexos | (se houver) |

---

## Arquivos que serão alterados

| Arquivo | O que muda |
|---|---|
| `js/excel/reader.js` | Fix detecção de cabeçalho (allCaps) |
| `js/render/vistorias.js` | Confirmar/ajustar nomes de coluna |
| `js/render/delib.js` | Ajustar WIDE_COLS para novas colunas |
| `js/render/mfo.js` | Verificar compatibilidade com 15 colunas |
| `js/render/checklist.js` | Já atualizado — só validar |
| `js/pdf/pages.js` | Ajustes finos por página conforme validação |

---

## Ordem de sessão

```
1. Abrir localhost
2. Subir BASE_SEMANAL_DADOS.xlsx
3. Etapa 1 (fix reader) → testar Página 0
4. Etapa 2 (CAPA) → testar Página 1
5. Seguir página a página, corrigindo conforme necessário
6. Gerar PDF e validar cada página
7. Só após aprovação total → commit único com tudo
```

---

## Critério de aprovação

Cada página passa quando:
- ✅ Dados carregados corretamente (sem campos vazios inesperados)
- ✅ Layout sem quebras visuais
- ✅ Zero erros no console do navegador
- ✅ PDF condizente com os dados exibidos na tela

---

*Plano gerado em 29/05/2026 — aguardando aprovação antes da execução*
