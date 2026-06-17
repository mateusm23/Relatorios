# Boas Práticas Usadas Nesta Sessão

> Registro de como os problemas da Capa, do PDF borrado e do filtro OCULTAR
> foram investigados e corrigidos — pra repetir o mesmo processo em sessões
> futuras.

---

## 1. Investigar antes de alterar

Antes de tocar em qualquer arquivo, usei `grep`/busca por palavras-chave
(`capa`, `avanco`, `estoque`, `OCULTAR`) pra mapear todos os lugares do
código que tocam no mesmo dado. Isso evitou corrigir só a prévia ao vivo
(`app.js`) e esquecer o gerador de PDF (`pdf/pages.js`), que duplica a
mesma lógica em arquivo separado.

**Regra prática:** sempre que uma lógica existe em mais de um lugar
(prévia vs. PDF, por exemplo), procurar TODAS as cópias antes de declarar
a correção concluída.

---

## 2. Rodar localmente e testar de verdade, não só ler o código

```bash
python -m http.server 8765
```

Servidor local descartável, criado e derrubado (`pkill`) a cada rodada de
teste. Ler o código diz o que ele *deveria* fazer; rodar mostra o que ele
*realmente* faz.

---

## 3. Automatizar a navegação com Playwright (simular o usuário de verdade)

Como não há framework de teste no projeto, usei Playwright (Python) pra:
- Subir a base Excel de exemplo (`templates/BASE_SEMANAL_DADOS.xlsx`)
- Clicar nos mesmos botões que o usuário clicaria (`#nav1`, `#btnSbGerar`)
- Ler valores reais da tela (`el.value`, `innerText`, `innerHTML`)
- Interceptar o download do PDF gerado pra inspecionar o arquivo final

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.goto('http://localhost:8765/index.html')
    pg.set_input_files('#uploadFile', 'templates/BASE_SEMANAL_DADOS.xlsx')
    pg.click('#nav1')
    valor = pg.eval_on_selector('#c_avanco', 'el => el.value')
```

**Por quê:** evita confiar em "deveria funcionar" — o teste roda o app de
verdade, no DOM real, com os mesmos eventos que o navegador dispara.

---

## 4. Inspeção visual: screenshot, crop e zoom

Sempre que a mudança era visual (gráfico segmentado, tamanho de caixa),
tirei screenshot do elemento exato (não da tela inteira) e ampliei a
região de interesse antes de aceitar como certo:

```python
box = pg.evaluate("() => document.querySelector('#el').getBoundingClientRect()")
pg.screenshot(path='out.png', clip=box)
```

Pra checar nitidez de texto no PDF, usei `device_scale_factor` alto no
Playwright e recortes ampliados com PIL (`Image.crop().resize(..., LANCZOS)`)
— sem isso, "parece bom" e "está nítido" são só impressão, não medição.

---

## 5. Comparar antes/depois pra não confundir bug novo com bug antigo

Quando a prévia da capa apareceu em branco após um upload, usei
`git stash` pra voltar o código ao estado original, reproduzir o mesmo
teste, e confirmar que o bug **já existia antes** das minhas mudanças
(não foi regressão minha). Só depois decidi corrigir, sabendo a real
causa (escala da prévia travando em 0 enquanto a página estava escondida).

```bash
git stash        # volta ao código original
# ...reproduzir o teste...
git stash pop     # traz as mudanças de volta
```

---

## 6. Instalar dependências sob demanda, só o necessário

Nenhuma ferramenta de inspeção foi pré-instalada — cada uma entrou só
quando o problema exigiu:
- `pip install playwright` (já estava disponível) → simular o usuário
- `pip install pymupdf` → abrir o PDF gerado e inspecionar resolução,
  tamanho de imagem embutida e DPI real, sem precisar de Adobe/visualizador
- `pip install openpyxl` → ler colunas e valores reais da planilha Excel
  (`templates/BASE_SEMANAL_DADOS.xlsx`) pra confirmar a fonte de verdade
  dos dados (ex: coluna OCULTAR já existia, com instrução "Retirar do
  relatório")

---

## 7. Sempre limpar depois

Todo arquivo e processo criado só pra teste foi removido ao final de cada
rodada — nada de lixo (`_verify_*.py`, `_out_*.pdf`, screenshots) sobrando
no repositório:

```bash
rm -f _verify_*.py _verify_*.png _out_*.pdf
pkill -f "http.server 8765"
git status --short   # confirma que só os arquivos de código mudaram
```

---

## 8. Pedir dados reais em vez de adivinhar

Quando o cálculo do "Avanço de Entregas" pareceu errado (91% sem fazer
sentido), em vez de tentar várias fórmulas no escuro, pedi os números
reais da obra (a tabela Resumo Geral que você já tinha na tela). Foi o
que revelou a causa raiz: a conta cruzava VISTORIAS (histórico) com
UNIDADES (status atual) e contava aprovação antiga de unidade que já
tinha mudado de categoria.

**Regra prática:** se o "errado" não é óbvio, pedir o valor esperado e o
valor mostrado, não tentar adivinhar a fórmula certa por tentativa e erro.

---

## 9. Investigar a causa raiz, não só remendar o sintoma

A caixa do "Avanço de Entregas" encolhendo no modo manual não foi
resolvida com `min-height` (remendo). Investigando o CSS, achei que o
verdadeiro problema era a ausência de largura fixa: sem a legenda de
texto, o `flex:1` da barra não tinha o que "esticar" e a barra colapsava
visualmente. A correção foi fixar a largura do card (`width:236px`), que
resolve a causa, não só o efeito.

---

## 10. Generalizar a correção pra casos parecidos — mas perguntando antes

Ao corrigir o filtro da coluna OCULTAR em Deliberações, notei que o
Checklist tinha exatamente a mesma coluna, com o mesmo propósito, e o
mesmo bug latente (linha de teste real com `OCULTAR = SIM` ainda visível).
Em vez de corrigir os dois silenciosamente ou ignorar o segundo, expus o
achado e perguntei se você queria a mesma correção lá — só implementei
depois da confirmação.

---

## 11. Confirmar antes de ações visíveis/irreversíveis

Commits locais não pedem confirmação (são reversíveis e não afetam
ninguém). `git push` para `origin/main` afeta o site publicado
(`mateusm23.github.io/Relatorios/`) — por isso sempre confirmei antes de
empurrar, e expliquei em termos simples a diferença entre "comitar" e
"publicar" quando havia dúvida.

---

## 12. Mensagens de commit que explicam o "porquê"

As mensagens de commit descrevem a motivação da mudança (por que o
cálculo antigo estava errado, por que a barra ficou segmentada), não só
o que foi alterado — útil pra entender decisões meses depois, sem
precisar reconstruir o raciocínio do zero.
