# Simulador AZ-900 (Microsoft Azure Fundamentals)

Simulador e treinador de questões para o exame **AZ-900**, baseado no guia de estudo oficial
(*habilidades medidas a partir de 20 de julho de 2026*). Roda 100% no navegador, sem dependências,
sem build e sem hospedagem. O histórico fica salvo no `localStorage` do navegador.

## Como executar

**Opção 1 (recomendada): servidor local**

```bash
./iniciar.sh
```

Depois abra <http://localhost:8900>. Sem o script: `python3 -m http.server 8900` dentro desta pasta.

**Opção 2:** abra o arquivo `index.html` direto no navegador (duplo clique). Funciona porque todo o
conteúdo é carregado por `<script>`, mas o histórico fica vinculado ao caminho do arquivo. Para manter
um histórico estável, prefira sempre o mesmo endereço (o servidor local na porta 8900).

## O que tem

| Modo | Questões | Detalhes |
|---|---|---|
| **Simulado oficial** | 45 (configurável: 40–60 ou aleatório) | 45 min, distribuição por eixo dentro das faixas oficiais (25–30% / 35–40% / 30–35%), tela de revisão, marcar para revisão, nota de 1 a 1000 (aprovação com 700) |
| **Eixo completo** | 30 | distribuídas entre os subtópicos do eixo |
| **Subtópico** | 15 | alternando entre os conteúdos do subtópico |
| **Conteúdo específico** | 10 | um item do guia (ex.: "2.3.3 Opções de redundância") |
| **Treino rápido** | 10 | mistas, proporcionais aos eixos |
| **Pontos fracos** | 20 | conteúdos com menor aproveitamento no seu histórico |
| **Revisar erros** | até 20 | questões erradas na última tentativa |

- **Modo estudo:** correção e explicação após cada questão. **Modo prova:** correção só no final.
- **Rotação:** o sorteio prioriza as questões menos vistas, para você percorrer o banco todo antes de repetir.
- **Tipos de questão do exame real:** múltipla escolha, múltipla seleção, Sim/Não, lista suspensa
  (completar a frase) e arrastar e soltar (com clique como alternativa), além de questões no formato
  "Solução: … Isso atende à meta?".
- **Correção detalhada:** o que você marcou, a resposta certa, a explicação e links para a documentação oficial.
- **Progresso:** gráfico das notas dos simulados, mapa de domínio por eixo, subtópico e conteúdo,
  cobertura do banco e os conteúdos mais fracos.
- **Histórico** de todas as sessões, **banco de questões** pesquisável com gabarito,
  **backup** (exportar/importar JSON), tema claro/escuro e atalhos de teclado.

## Banco de questões

543 questões em português, categorizadas nos 57 conteúdos dos 11 subtópicos do guia:

| Eixo | Peso no exame | Questões |
|---|---|---|
| 1. Descrever os conceitos da nuvem | 25–30% | 143 |
| 2. Descrever a arquitetura e os serviços do Azure | 35–40% | 242 |
| 3. Descrever o gerenciamento e a governança do Azure | 30–35% | 158 |

## Como a nota é calculada

Seguindo a [política de pontuação da Microsoft](https://learn.microsoft.com/credentials/certifications/exam-scoring-reports):

1. Cada parte correta vale **1 ponto** (Sim/Não, múltipla seleção, listas e arrastar e soltar valem vários pontos). Não há penalidade por erro.
2. A nota de corte bruta é estimada no estilo **Angoff modificado**: cada questão tem uma dificuldade
   (fácil, média ou difícil) associada à probabilidade de um candidato minimamente qualificado acertá-la
   (78%, 68% e 55%). A média ponderada dessas probabilidades nas questões sorteadas define o percentual
   de pontos que equivale a **700**. Provas mais difíceis exigem menos pontos, e provas mais fáceis exigem mais.
3. A escala é linear em dois trechos: de 0 ao corte vai de 1 a 700, e do corte a 100% vai de 700 a 1000.

A fórmula exata da Microsoft não é pública. Use a nota como indicador e mire em **800 ou mais** com consistência.

## Estrutura

```
index.html          página única (SPA com rotas por hash)
css/style.css       estilos (tema claro/escuro, responsivo)
data/syllabus.js    eixos, subtópicos e conteúdos do guia oficial
data/q-X-Y.js       questões do subtópico X.Y
js/core.js          utilitários, armazenamento local, índice e validação do banco
js/engine.js        montagem das sessões, correção e pontuação
js/render.js        renderização dos tipos de questão
js/app.js           telas, navegação, cronômetro e histórico
```

### Adicionar questões

Acrescente objetos ao arquivo do subtópico (o tipo é inferido pelos campos; veja o formato em
`data/syllabus.js`). Exemplo de múltipla escolha:

```js
{ s: 3, d: 2,                 // conteúdo 3 do subtópico, dificuldade média
  q: 'Enunciado…',
  o: ['Correta', 'Distrator 1', 'Distrator 2', 'Distrator 3'],
  a: 0,                       // as opções são embaralhadas na exibição
  e: 'Explicação…' }
```

O ID de cada questão é derivado do conteúdo dela: se você editar o texto de uma questão, as
estatísticas antigas dessa questão deixam de ser associadas a ela. Questões com formato inválido são
ignoradas e listadas no console do navegador.

> Projeto de estudo independente, sem afiliação com a Microsoft. Confira sempre a documentação oficial no Microsoft Learn.
