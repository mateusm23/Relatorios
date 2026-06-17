export const DB = {
  unidades: [], vistorias: [], delib: [], mfo: [], checklist: [],
  categorias: [],
  parecer: '',
  anexos: Array(6).fill(null),
  foto: null, logo: null,
  avancoStats: null // { aprovadas, estoque, total } — usado pra desenhar a barra segmentada da capa
};

export const MESES = [
  'janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro'
];
