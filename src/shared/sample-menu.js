// Cardápio de exemplo (Bistrô do Porto): usado na demonstração e na página inicial.
// Fotos de exemplo: ilustração simples (emoji sobre fundo colorido), só na demonstração.
const photo = (emoji, bg) =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${bg}"/><text x="200" y="190" font-size="150" text-anchor="middle">${emoji}</text></svg>`);
export function sampleMenu() {
  const images = {};
  const it = (id, name, desc, price, extra = {}) => {
    const { e, bg, ...rest } = extra;
    if (e) images['f-' + id] = photo(e, bg);
    return { id, name, desc, price, available: true, img: e ? 'f-' + id : null, tag: null, opts: null, ...rest };
  };
  const menu = {
    categories: [
      { id: 'entradas', name: 'Entradas', items: [
        it('bac', 'Bolinho de bacalhau', '6 unidades, com maionese de ervas.', 3800, { e: '🧆', bg: '#f6e3c4' }),
        it('siri', 'Casquinha de siri', 'Gratinada com queijo e farofa da casa.', 2900, { e: '🦀', bg: '#fde2d6' }),
        it('pas', 'Pastel de camarão', '4 unidades.', 3400),
      ] },
      { id: 'pratos', name: 'Pratos', items: [
        it('moq', 'Moqueca de peixe', 'Serve 2 pessoas. Acompanha arroz, pirão e farofa.', 12900, { e: '🍲', bg: '#fde7c8', tag: 'Mais pedido' }),
        it('ris', 'Risoto de camarão', 'Arroz arbóreo, camarão e limão-siciliano.', 7900, { e: '🍤', bg: '#fbe3dc' }),
        it('pei', 'Peixe grelhado', 'Com legumes salteados e arroz de brócolis.', 6800, { e: '🐟', bg: '#dcecf2', opts: { title: 'Ponto do peixe', choices: ['Ao ponto', 'Bem passado'] } }),
        it('par', 'Filé à parmegiana', 'Com arroz e batata frita.', 7200),
      ] },
      { id: 'bebidas', name: 'Bebidas', items: [
        it('suc', 'Suco natural', '500 ml.', 1200, { e: '🍹', bg: '#fdf0c4', opts: { title: 'Sabor', choices: ['Laranja', 'Limão', 'Abacaxi com hortelã'] } }),
        it('ref', 'Refrigerante lata', '350 ml.', 700, { opts: { title: 'Qual', choices: ['Cola', 'Cola zero', 'Guaraná'] } }),
        it('cho', 'Chope', '300 ml.', 1400, { e: '🍺', bg: '#fbefc9' }),
        it('agu', 'Água mineral', 'Com ou sem gás.', 600, { opts: { title: 'Tipo', choices: ['Sem gás', 'Com gás'] } }),
      ] },
      { id: 'sobremesas', name: 'Sobremesas', items: [
        it('pud', 'Pudim de leite', 'Fatia.', 1600, { e: '🍮', bg: '#f8e5c3' }),
        it('pet', 'Petit gâteau', 'Com sorvete de creme.', 2600, { e: '🍫', bg: '#ead8cf' }),
      ] },
    ],
  };
  return { menu, images };
}
