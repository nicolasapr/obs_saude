const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ console });
const source = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
assert.match(source, /\ninit\(\);\s*$/);
// Executa as funções sem iniciar a interface nem fazer consultas de rede.
vm.runInContext(source.replace(/\ninit\(\);\s*$/, '\n'), context);

const rows = [
  { mes: '2019-01', feijao: 10 },
  { mes: '2019-02', feijao: null },
  { mes: '2019-03', feijao: 30 },
];
const result = context.serieMensalContinua(rows, 'feijao');
assert.equal(result.interpolados, 1);
assert.deepEqual(Array.from(result.ys), [10, 20, 30]);
assert.equal(rows[1].feijao, null, 'A decomposição não pode alterar os dados observados');
assert.equal(context.serieMensalContinua([], 'feijao').interpolados, 0);
assert.equal(context.labelContagem('pnaes'), 'Municípios');
assert.equal(context.labelContagem('sisvan'), 'Respostas válidas');
console.log('Testes JavaScript: interpolação contabilizada, fontes preservadas e rótulos corretos.');
