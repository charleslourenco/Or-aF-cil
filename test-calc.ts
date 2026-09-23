import { calcularBOM, Dimensoes, MdfSpec, ModuloComposicao } from './src/lib/pricing'

const dim: Dimensoes = {
  largura: 1550,
  altura: 2500,
  profundidade: 650,
}

const mdfExt: MdfSpec = { cor: 'Branco', espessura: 15 }
const mdfInt: MdfSpec = { cor: 'Branco', espessura: 15 }

const composicao: ModuloComposicao = {
  divisorias: { qtd: 1 },
  corpos: [
    { id: 'corpo-1', gavetas: 4, prateleiras: 1, cabideiro: true },
    { id: 'corpo-2', gavetas: 0, prateleiras: 3, cabideiro: true },
  ],
  portas: { qtd: 2, tipo: 'correr' },
  puxadores: 2,
}

const pecas = calcularBOM(dim, mdfExt, mdfInt, '6mm Branco', 'comercial', 1.0, composicao)

console.log('=== ITENS DA BOM GERADA ===')
for (const p of pecas) {
  console.log(`- [${p.material}] ${p.description} (metragem: ${p.metragem} ${p.unidade})`)
}
