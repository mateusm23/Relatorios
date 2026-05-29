import { DB } from '../state.js';
import { v } from '../utils.js';
import { showToast } from '../toast.js';
import { calcStats } from '../render/vistorias.js';

// ── Helpers de data para geração de template ──────────────────────────────────

const PT_MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function isoWeekFromBR(dateStr) {
  const [d, m, y] = dateStr.split('/').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dow);
  const jan1 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil(((dt - jan1) / 86400000 + 1) / 7);
}

function mesNomeFromBR(dateStr) {
  const [, m] = dateStr.split('/').map(Number);
  return PT_MESES_NOMES[m - 1] || '';
}

function deltaDias(prazo1, prazo2) {
  const parse = s => { const [d, m, y] = s.split('/').map(Number); return new Date(y, m - 1, d); };
  try { return Math.round((parse(prazo2) - parse(prazo1)) / 86400000); } catch { return 0; }
}

// ── Gerar / Exportar Excel dos dados atuais ───────────────────────────────────

export async function gerarXLSX() {
  if (!v('c_nome')) { showToast('err', '❌ Preencha o nome da obra'); return; }
  showToast('load', 'Gerando Excel...');
  await new Promise(r => setTimeout(r, 100));
  try {
    const wb = window.XLSX.utils.book_new();
    const addSh = (name, aoa, cw) => {
      const ws = window.XLSX.utils.aoa_to_sheet(aoa);
      if (cw) ws['!cols'] = cw.map(w => ({ wch: w }));
      ws['!pageSetup'] = { paperSize: 9, fitToPage: true, fitToWidth: 1 };
      window.XLSX.utils.book_append_sheet(wb, ws, name);
    };
    const semStr = v('c_sem') || 'XX';

    addSh('CAPA', [
      ['CAPA — RELATÓRIO SEMANAL DE OBRA'],
      [''],
      ['OBRA',               v('c_nome')],
      ['CONSTRUTORA',        v('c_obra')],
      ['GERENCIADORA',       v('c_ger')],
      ['ENGENHEIRO',         v('c_eng')],
      [''],
      ['DATA INICIO',        v('c_ini')],
      ['DATA FIM',           v('c_fim')],
      ['SEMANA No',          semStr],
      ['AVANCO DE ENTREGAS', v('c_avanco')],
      [''],
      ['PONTOS POSITIVOS',   v('positivos')],
      ['PONTOS DE ATENCAO',  v('atencao')],
      ['ENCAMINHAMENTOS',    v('encam')],
    ], [25, 70]);

    if (v('parecer')) {
      addSh('PARECER', [
        ['PARECER SEMANAL'],
        [''],
        [v('parecer')],
      ], [110]);
    }

    if (DB.unidades.length) {
      const c = Object.keys(DB.unidades[0]);
      addSh('UNIDADES', [c, ...DB.unidades.map(r => c.map(k => r[k] || ''))], [10, 14, 14, 32]);
    }
    if (DB.vistorias.length) {
      const c = Object.keys(DB.vistorias[0]);
      addSh('VISTORIAS', [c, ...DB.vistorias.map(r => c.map(k => r[k] || ''))], [14, 16, 22, 36, 12, 14]);
      const s = calcStats(DB.vistorias);
      addSh('VISÃO TOTAL', [
        ['TOTAL', 'APROVADAS', 'REPROVADAS', 'NÃO COMP.', 'TAXA A.', 'TAXA R.', 'TAXA NC'],
        [s.t, s.a, s.r, s.n, s.pa, s.pr, s.pn]
      ], [18, 16, 16, 18, 14, 14, 12]);
    }
    if (DB.delib.length) {
      const c = Object.keys(DB.delib[0]);
      addSh('DELIBERAÇÕES', [c, ...DB.delib.map(r => c.map(k => r[k] || ''))], [14, 16, 52, 14, 14, 12, 22, 16]);
    }
    if (DB.mfo.length) {
      const c = Object.keys(DB.mfo[0]);
      addSh('MFO', [c, ...DB.mfo.map(r => c.map(k => r[k] || ''))], [32, ...Array(c.length - 1).fill(16)]);
    }
    if (DB.checklist.length) {
      const c = Object.keys(DB.checklist[0]);
      addSh('CHECKLIST', [c, ...DB.checklist.map(r => c.map(k => r[k] || ''))], [20, 38, 14, 14, 10, 14, 20, 38, 10]);
    }

    window.XLSX.writeFile(wb, 'RLT_SEM' + semStr + '_' + v('c_nome').replace(/\s+/g, '_').toUpperCase() + '.xlsx');
    showToast('ok', '✅ Excel gerado!');
  } catch (e) { showToast('err', '❌ Erro: ' + e.message); }
}

// ── Template em branco ────────────────────────────────────────────────────────

export function baixarTemplateEmBranco() {
  try {
    const wb = window.XLSX.utils.book_new();
    const addSh = (name, aoa, cw) => {
      const ws = window.XLSX.utils.aoa_to_sheet(aoa);
      if (cw) ws['!cols'] = cw.map(w => ({ wch: w }));
      window.XLSX.utils.book_append_sheet(wb, ws, name);
    };

    // CONFIG
    addSh('CONFIG', [
      ['CONFIGURAÇÕES — CATEGORIAS DE UNIDADES'],
      ['Define até 8 categorias. Estas serão as opções disponíveis na aba UNIDADES.'],
      ['CATEGORIA'],
      ['Aprovou Vistoria'],
      ['Liberado'],
      ['Estoque'],
      ['Restrição'],
      [''], [''], [''], [''],
    ], [40]);

    // CAPA
    addSh('CAPA', [
      ['CAPA — RELATÓRIO SEMANAL DE OBRA'],
      [''],
      ['OBRA',               ''],
      ['CONSTRUTORA',        ''],
      ['GERENCIADORA',       ''],
      ['ENGENHEIRO',         ''],
      [''],
      ['DATA INICIO',        ''],
      ['DATA FIM',           ''],
      ['SEMANA No',          ''],
      ['AVANCO DE ENTREGAS', ''],
      [''],
      ['PONTOS POSITIVOS',   ''],
      ['PONTOS DE ATENCAO',  ''],
      ['ENCAMINHAMENTOS',    ''],
    ], [25, 70]);

    // PARECER
    addSh('PARECER', [
      ['PARECER TÉCNICO'],
      ['Descreva o parecer técnico da semana abaixo:'],
      [''],
    ], [110]);

    // UNIDADES
    addSh('UNIDADES', [
      ['MAPA DE UNIDADES'],
      ['BLOCO: identificador do bloco (ex: A, B, Torre 1) | PAVIMENTO: número do andar | UNIDADE: código único (ex: A-101) | CATEGORIA: conforme aba CONFIG'],
      ['BLOCO', 'PAVIMENTO', 'UNIDADE', 'CATEGORIA'],
    ], [16, 16, 16, 28]);

    // VISTORIAS
    addSh('VISTORIAS', [
      ['REGISTRO DE VISTORIAS'],
      ['UNIDADE: código da unidade | DATA VISTORIA: dd/mm/aaaa | STATUS: Aprovado / Reprovado / Não Compareceu | MOTIVO REPROVAÇÃO: somente se reprovado | SEMANA Nº: auto | MÊS: auto'],
      ['UNIDADE', 'DATA VISTORIA', 'STATUS', 'MOTIVO REPROVAÇÃO', 'SEMANA Nº', 'MÊS'],
    ], [16, 16, 22, 36, 12, 14]);

    // DELIBERAÇÕES
    addSh('DELIBERAÇÕES', [
      ['REGISTRO DE DELIBERAÇÕES'],
      ['DATA CADASTRO: abertura | TIPO: Técnico / Adm. / Jurídico | DESCRIÇÃO: detalhamento | 1º PRAZO: prazo original | PRAZO ATUAL: prazo vigente | DELTA DIAS: calculado | RESPONSÁVEL: nome | STATUS: Pendente / Em Andamento / Concluído'],
      ['DATA CADASTRO', 'TIPO', 'DESCRIÇÃO', '1º PRAZO', 'PRAZO ATUAL', 'DELTA DIAS', 'RESPONSÁVEL', 'STATUS'],
    ], [14, 16, 52, 14, 14, 12, 22, 16]);

    // MFO
    addSh('MFO', [
      ['MONITORAMENTO FINANCEIRO DE OBRA (MFO)'],
      ['Preencha os campos em branco. Campos calculados: SALDO DE CONTRATOS, DESVIOS. Valores em R$.'],
      ['DESCRIÇÃO', 'VALOR ORÇADO', 'VALOR ATUALIZADO', 'PAGO', 'A PAGAR', 'SALDO DE CONTRATOS', 'COMPROMETIDO', 'SALDO ORÇ. NOMINAL', 'SALDO ORÇ. CORRIGIDO', 'PREV. FINANCEIRA', 'CUSTO AO TÉRMINO', 'DESVIO NOMINAL R$', 'DESVIO NOMINAL %', 'DESVIO CORRIGIDO R$', 'DESVIO CORRIGIDO %'],
    ], [32, 16, 18, 16, 16, 20, 16, 20, 20, 18, 18, 18, 16, 18, 16]);

    // CHECKLIST
    addSh('CHECKLIST', [
      ['CHECKLIST DE ÁREA COMUM'],
      ['ÁREA/LOCAL: local físico | ITEM: descrição | 1º PRAZO: prazo original | PRAZO ATUAL: prazo vigente | DELTA: dias calculado | STATUS: OK / Pendente / Atenção / Não Conforme | RESPONSÁVEL | OBSERVAÇÃO | OCULTAR: S para esconder'],
      ['ÁREA / LOCAL', 'ITEM', '1º PRAZO', 'PRAZO ATUAL', 'DELTA', 'STATUS', 'RESPONSÁVEL', 'OBSERVAÇÃO', 'OCULTAR'],
    ], [20, 38, 14, 14, 10, 14, 20, 38, 10]);

    window.XLSX.writeFile(wb, 'MODELO_BASE_SEMANAL_VAZIO.xlsx');
    showToast('ok', '✅ Modelo em branco baixado!');
  } catch (e) { showToast('err', '❌ Erro: ' + e.message); }
}

// ── Template com dados de exemplo ────────────────────────────────────────────

export function baixarTemplateComDados() {
  try {
    const wb = window.XLSX.utils.book_new();
    const addSh = (name, aoa, cw) => {
      const ws = window.XLSX.utils.aoa_to_sheet(aoa);
      if (cw) ws['!cols'] = cw.map(w => ({ wch: w }));
      window.XLSX.utils.book_append_sheet(wb, ws, name);
    };

    // ── CONFIG ────────────────────────────────────────────────────────────────
    addSh('CONFIG', [
      ['CONFIGURAÇÕES — CATEGORIAS DE UNIDADES'],
      ['Define até 8 categorias. Estas serão as opções disponíveis na aba UNIDADES.'],
      ['CATEGORIA'],
      ['Aprovou Vistoria'],
      ['Liberado'],
      ['Estoque'],
      ['Restrição'],
      [''], [''], [''], [''],
    ], [40]);

    // ── CAPA ──────────────────────────────────────────────────────────────────
    addSh('CAPA', [
      ['CAPA — RELATÓRIO SEMANAL DE OBRA'],
      [''],
      ['OBRA',               'RESIDENCIAL ARVOREDO'],
      ['CONSTRUTORA',        'CONSTRUTORA NOVA ERA LTDA'],
      ['GERENCIADORA',       'Trinus Co. Participações'],
      ['ENGENHEIRO',         'Eng. Ricardo Alves'],
      [''],
      ['DATA INICIO',        '2026-05-18'],
      ['DATA FIM',           '2026-05-24'],
      ['SEMANA No',          '21'],
      ['AVANCO DE ENTREGAS', ''],
      [''],
      ['PONTOS POSITIVOS',   '• Ritmo de vistorias acima do esperado\n• Boa adesão dos moradores à nova agenda'],
      ['PONTOS DE ATENCAO',  '• Unidades com restrição no Bloco B (pavimentos 7–10)\n• 2 deliberações com prazo vencendo'],
      ['ENCAMINHAMENTOS',    '• Reagendar vistorias reprovadas — Resp: Engenharia — Prazo: 30/05\n• Acionar construtora sobre trinca fachada B — Prazo: 01/06'],
    ], [25, 70]);

    // ── PARECER ───────────────────────────────────────────────────────────────
    addSh('PARECER', [
      ['PARECER TÉCNICO'],
      [''],
      ['A semana 21 apresentou avanço positivo no ciclo de vistorias do Residencial Arvoredo. ' +
       'Foram realizadas 42 vistorias, com taxa de aprovação de 74%. ' +
       'O Bloco A encontra-se em estágio avançado, com 83% das unidades aprovadas. ' +
       'O Bloco B demanda atenção especial nos pavimentos superiores (7º ao 10º), onde há maior concentração de restrições por acabamento incompleto. ' +
       'As deliberações em aberto totalizam 4 itens, sendo 2 com prazo próximo (até 30/05). ' +
       'Recomenda-se priorizar o reagendamento das vistorias reprovadas antes do encerramento do mês.'],
    ], [110]);

    // ── UNIDADES (120 = 2 blocos × 10 pavimentos × 6 unidades) ───────────────
    const CATS_DIST = [
      'Aprovou Vistoria','Aprovou Vistoria','Aprovou Vistoria','Aprovou Vistoria',
      'Liberado','Estoque','Restrição',
    ];
    const unidades = [
      ['MAPA DE UNIDADES'],
      ['BLOCO: identificador do bloco (ex: A, B, Torre 1) | PAVIMENTO: número do andar | UNIDADE: código único (ex: A-101) | CATEGORIA: conforme aba CONFIG'],
      ['BLOCO', 'PAVIMENTO', 'UNIDADE', 'CATEGORIA'],
    ];
    const allUnits = [];
    let cIdx = 0;
    ['A', 'B'].forEach(bloco => {
      for (let pav = 1; pav <= 10; pav++) {
        for (let u = 1; u <= 6; u++) {
          const unid = `${bloco}-${pav}0${u}`;
          const cat = CATS_DIST[(cIdx++ * 3 + (bloco === 'B' ? 2 : 0)) % CATS_DIST.length];
          unidades.push([bloco, pav, unid, cat]);
          if (cat !== 'Estoque') allUnits.push(unid);
        }
      }
    });
    addSh('UNIDADES', unidades, [16, 16, 16, 28]);

    // ── VISTORIAS (~300) ──────────────────────────────────────────────────────
    let rng = 42;
    const rand = () => { rng = (rng * 1664525 + 1013904223) & 0x7fffffff; return rng / 0x7fffffff; };
    const pick = arr => arr[Math.floor(rand() * arr.length)];

    const STATUS_VIS = ['Aprovado','Aprovado','Aprovado','Reprovado','Não Compareceu'];
    const MOTIVOS    = ['Acabamento incompleto','Pintura com defeito','Problemas hidráulicos',
                        'Janelas com folga','Piso irregular','Documentação pendente'];
    const MESES_CFG  = [
      { mes: 'março',  mesN: '03', semBase: 9,  dias: 28, total: 80  },
      { mes: 'abril',  mesN: '04', semBase: 14, dias: 30, total: 120 },
      { mes: 'maio',   mesN: '05', semBase: 18, dias: 24, total: 100 },
    ];

    const vistorias = [
      ['REGISTRO DE VISTORIAS'],
      ['UNIDADE: código da unidade | DATA VISTORIA: dd/mm/aaaa | STATUS: Aprovado / Reprovado / Não Compareceu | MOTIVO REPROVAÇÃO: somente se reprovado | SEMANA Nº: auto | MÊS: auto'],
      ['UNIDADE', 'DATA VISTORIA', 'STATUS', 'MOTIVO REPROVAÇÃO', 'SEMANA Nº', 'MÊS'],
    ];
    MESES_CFG.forEach(({ mes, mesN, semBase, dias, total }) => {
      for (let i = 0; i < total; i++) {
        const unid   = pick(allUnits);
        const day    = String(Math.floor(rand() * dias) + 1).padStart(2, '0');
        const dateStr = `${day}/${mesN}/2026`;
        const status = pick(STATUS_VIS);
        const motivo = status === 'Reprovado' ? pick(MOTIVOS) : '';
        const semNum = isoWeekFromBR(dateStr);
        const mesNome = mesNomeFromBR(dateStr);
        vistorias.push([unid, dateStr, status, motivo, semNum, mesNome]);
      }
    });
    addSh('VISTORIAS', vistorias, [16, 16, 22, 36, 12, 14]);

    // ── DELIBERAÇÕES ──────────────────────────────────────────────────────────
    const delibRows = [
      ['05/01/2026', 'Técnico',        'Revisão e aprovação do projeto elétrico do Bloco B',         '10/05/2026', '10/05/2026', 0,   'Eng. Ricardo Alves', 'Concluído'],
      ['10/02/2026', 'Técnico',        'Correção de infiltração no pavimento 3 — Bloco A',            '15/05/2026', '15/05/2026', 0,   'Gerência de Obra',   'Concluído'],
      ['15/03/2026', 'Operacional',    'Reagendamento de vistorias reprovadas por acabamento',        '20/05/2026', '25/05/2026', 5,   'Supervisão',         'Concluído'],
      ['01/04/2026', 'Técnico',        'Adequação do sistema de ventilação — 8º pavimento',           '30/05/2026', '30/05/2026', 0,   'Eng. Responsável',   'Pendente'],
      ['10/04/2026', 'Administrativo', 'Entrega de manuais de uso às unidades aprovadas',             '05/06/2026', '05/06/2026', 0,   'Adm. Obra',          'Pendente'],
      ['15/04/2026', 'Operacional',    'Instalação de medidores individuais — Bloco A concluído',     '20/05/2026', '25/05/2026', 5,   'Empreiteiro',        'Concluído'],
      ['20/04/2026', 'Operacional',    'Pintura das áreas comuns — corredor e hall de entrada',       '28/05/2026', '28/05/2026', 0,   'Equipe Pintura',     'Em Andamento'],
      ['25/04/2026', 'Operacional',    'Limpeza técnica pré-vistoria — Bloco B pavimentos 6–10',      '22/05/2026', '22/05/2026', 0,   'Terceirizada',       'Concluído'],
      ['01/05/2026', 'Jurídico',       'Regularização do habite-se junto à prefeitura',               '15/06/2026', '15/06/2026', 0,   'Adv. Jurídico',      'Pendente'],
      ['05/05/2026', 'Técnico',        'Correção de trinca fachada lateral Bloco B — laudo estrutural','01/06/2026', '10/06/2026', 9,   'Eng. Estrutural',    'Em Andamento'],
    ];
    addSh('DELIBERAÇÕES', [
      ['REGISTRO DE DELIBERAÇÕES'],
      ['DATA CADASTRO: abertura | TIPO: Técnico / Adm. / Jurídico | DESCRIÇÃO: detalhamento | 1º PRAZO: prazo original | PRAZO ATUAL: prazo vigente | DELTA DIAS: calculado | RESPONSÁVEL: nome | STATUS: Pendente / Em Andamento / Concluído'],
      ['DATA CADASTRO', 'TIPO', 'DESCRIÇÃO', '1º PRAZO', 'PRAZO ATUAL', 'DELTA DIAS', 'RESPONSÁVEL', 'STATUS'],
      ...delibRows,
    ], [14, 16, 52, 14, 14, 12, 22, 16]);

    // ── MFO ───────────────────────────────────────────────────────────────────
    const mfoData = [
      // [DESCRIÇÃO, ORÇADO, ATUALIZADO, PAGO, A_PAGAR, SALDO_CONT, COMPROM, SALDO_NOM, SALDO_CORR, PREV_FIN, CUSTO_TERM, DEV_NOM_R, DEV_NOM_PCT, DEV_CORR_R, DEV_CORR_PCT]
      ['Obras Civis — Estrutura',      1250000, 1275000,  950000, 300000,  100000, 1150000, 125000, 100000, 1280000, 1320000,  -45000, '-3,5%',  -70000, '-5,5%'],
      ['Obras Civis — Acabamento',      980000,  990000,  560000, 430000,   80000,  910000,  80000,  70000, 1010000, 1050000,  -60000, '-5,9%',  -80000, '-7,8%'],
      ['Instalações Elétricas',         420000,  420000,  380000,  40000,   20000,  400000,  20000,  20000,  430000,  445000,  -10000, '-2,2%',  -15000, '-3,5%'],
      ['Instalações Hidrossanitárias',  380000,  385000,  310000,  75000,   30000,  355000,  30000,  25000,  390000,  405000,  -10000, '-2,6%',  -25000, '-6,5%'],
      ['Elevadores e Automação',        280000,  280000,  280000,      0,       0,  280000,      0,      0,  280000,  280000,       0,  '0,0%',       0,  '0,0%'],
      ['Paisagismo e Áreas Comuns',     145000,  148000,   50000,  98000,   40000,  108000,  40000,  37000,  155000,  162000,  -10000, '-6,4%',  -17000, '-11,5%'],
      ['Administração e Gerenciamento', 210000,  210000,  168000,  42000,   10000,  200000,  10000,  10000,  215000,  220000,   -5000, '-2,4%',  -10000, '-4,8%'],
      ['Contingências',                  85000,   85000,   20000,  65000,   60000,   25000,  65000,  65000,   90000,   95000,   -5000, '-5,3%',  -10000, '-11,8%'],
    ];
    addSh('MFO', [
      ['MONITORAMENTO FINANCEIRO DE OBRA (MFO)'],
      ['Preencha os campos em branco. Campos calculados: SALDO DE CONTRATOS, DESVIOS. Valores em R$.'],
      ['DESCRIÇÃO', 'VALOR ORÇADO', 'VALOR ATUALIZADO', 'PAGO', 'A PAGAR', 'SALDO DE CONTRATOS', 'COMPROMETIDO', 'SALDO ORÇ. NOMINAL', 'SALDO ORÇ. CORRIGIDO', 'PREV. FINANCEIRA', 'CUSTO AO TÉRMINO', 'DESVIO NOMINAL R$', 'DESVIO NOMINAL %', 'DESVIO CORRIGIDO R$', 'DESVIO CORRIGIDO %'],
      ...mfoData,
    ], [32, 16, 18, 16, 16, 20, 16, 20, 20, 18, 18, 18, 16, 18, 16]);

    // ── CHECKLIST ─────────────────────────────────────────────────────────────
    const chkData = [
      ['Hall / Entrada',    'Limpeza do hall de entrada',               '01/05/2026', '20/05/2026',  19, 'OK',           'Equipe Limpeza',   '',                           ''],
      ['Elétrica',          'Iluminação de emergência — teste mensal',  '01/05/2026', '15/05/2026',  14, 'OK',           'Manutenção',       'Todas as luminárias testadas',''],
      ['Elevadores',        'Elevador — manutenção preventiva',         '01/05/2026', '10/05/2026',   9, 'OK',           'Empresa Elevador', 'Certificado emitido',         ''],
      ['Portaria',          'Portão eletrônico — funcionamento',        '01/05/2026', '18/05/2026',  17, 'OK',           'Manutenção',       '',                           ''],
      ['Hidráulica',        "Bomba d'água — verificação de pressão",   '01/05/2026', '16/05/2026',  15, 'OK',           'Hidráulica',       '',                           ''],
      ['Segurança',         'Câmeras de segurança — gravação ativa',    '01/05/2026', '19/05/2026',  18, 'OK',           'TI/Segurança',     '14 dias de gravação',        ''],
      ['Área Verde',        'Jardim — irrigação e poda semanal',        '01/05/2026', '17/05/2026',  16, 'Pendente',     'Jardinagem',       'Reagendar para semana 22',   ''],
      ['Salão de Festas',   'Limpeza do salão pós-evento',              '10/05/2026', '21/05/2026',  11, 'OK',           'Equipe Limpeza',   '',                           ''],
      ['Academia',          'Equipamentos e higienização',              '01/05/2026', '20/05/2026',  19, 'OK',           'Manutenção',       '',                           ''],
      ['Piscina',           'pH e nível de cloro',                      '01/05/2026', '19/05/2026',  18, 'Atenção',      'Piscina Maint.',   'pH fora do padrão',          ''],
      ['Segurança',         'Extintores — validade e recarga',          '01/05/2026', '12/05/2026',  11, 'OK',           'CIPA',             'Próxima revisão: nov/26',    ''],
      ['Hidráulica',        "Caixa d'água — limpeza semestral",        '01/05/2026', '05/05/2026',   4, 'OK',           'Hidráulica',       'Laudo sanitário emitido',    ''],
      ['Garagem',           'Estacionamento — sinalização e iluminação','01/05/2026', '18/05/2026',  17, 'OK',           'Manutenção',       '',                           ''],
      ['Área de Lazer',     'Playground — vistoria de segurança',       '01/05/2026', '13/05/2026',  12, 'OK',           'Manutenção',       '',                           ''],
      ['Circulação',        'Corredores — lâmpadas e sensores',         '01/05/2026', '20/05/2026',  19, 'Atenção',      'Elétrica',         '3 sensores para troca',      ''],
    ];
    addSh('CHECKLIST', [
      ['CHECKLIST DE ÁREA COMUM'],
      ['ÁREA/LOCAL: local físico | ITEM: descrição | 1º PRAZO: prazo original | PRAZO ATUAL: prazo vigente | DELTA: dias calculado | STATUS: OK / Pendente / Atenção / Não Conforme | RESPONSÁVEL | OBSERVAÇÃO | OCULTAR: S para esconder'],
      ['ÁREA / LOCAL', 'ITEM', '1º PRAZO', 'PRAZO ATUAL', 'DELTA', 'STATUS', 'RESPONSÁVEL', 'OBSERVAÇÃO', 'OCULTAR'],
      ...chkData,
    ], [20, 38, 14, 14, 10, 14, 20, 38, 10]);

    window.XLSX.writeFile(wb, 'TEMPLATE - TRINUS (Com Dados).xlsx');
    showToast('ok', '✅ Template com dados baixado!');
  } catch (e) { showToast('err', '❌ Erro: ' + e.message); }
}
