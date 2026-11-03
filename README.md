# Desafio Trainee Tech Spacecom: Detecção de Encontros

Solução para o desafio técnico de detecção de encontros físicos entre monitorados (tornozeleira eletrônica) e vítimas com medida protetiva, a partir de dados de geolocalização.

## Tecnologias

- **TypeScript + Node.js**, executado com [`tsx`](https://github.com/privatenumber/tsx).
- Nenhuma dependência de produção: só módulos nativos do Node (`fs`, `readline`, `events`).

**Por que TypeScript:** a tipagem estática (interfaces `Posicionamento` e `Encontro`) garante que cada registro lido e cada encontro gerado tenham exatamente a estrutura exigida no output, e erros de campo aparecem na compilação em vez de em tempo de execução.

## Como executar

Requisito: Node.js 18 ou superior.

1. Abra o terminal e entre na pasta do projeto (a que contém o `index.ts`):

   ```bash
   cd desafio-spacecom
   ```

2. Instale as dependências:

   ```bash
   npm install
   ```
   
3. Coloque os arquivos de input (`dataset1.txt` a `dataset7.txt`) na raiz do projeto, ao lado do `index.ts`. Datasets ausentes são ignorados.

4. Execute:

   ```bash
   npm start
   ```

   (equivalente a `npx tsx index.ts`)

Os arquivos `respostas1.json` a `respostas7.json` são gerados na raiz do projeto. O tempo de cada dataset é exibido no terminal.

Para checar os tipos sem executar:

```bash
npm run typecheck
```

## Lógica da solução

### 1. Leitura em stream, um timestamp por vez

Os datasets chegam a 12 milhões de linhas (cerca de 640 MB no `dataset7.txt`). Carregar tudo em memória antes de processar estoura o limite padrão de heap do Node.

Como os posicionamentos só podem ser comparados com outros do **mesmo timestamp** e os arquivos vêm ordenados por timestamp, o arquivo é lido linha a linha (`readline`, evento `line`) e as linhas são acumuladas num grupo enquanto o timestamp não muda. Quando o timestamp muda, o grupo é processado e descartado. Assim só um timestamp (de 60 a 120 pessoas nos datasets oficiais) fica em memória por vez. Os 7 datasets processam com menos de 64 MB de heap.

Se uma linha aparecer com timestamp anterior ao do grupo atual, o programa emite um aviso indicando que o arquivo não está ordenado.

### 2. Comparação de pares dentro do timestamp

Dentro de cada grupo, cada par é comparado uma única vez (`j = i + 1`). Isso garante a **unicidade** exigida: se A encontra B, o par B–A não é gerado de novo.

Antes de calcular a distância completa há um **pré-filtro exato**: a distância de Haversine nunca é menor que `R × |Δlatitude|` (em radianos). Se só a diferença de latitude já soma 20 m ou mais, o par é descartado sem calcular senos e cossenos. O filtro não muda nenhum resultado, só evita trabalho.

### 3. Distância (fórmula de Haversine)

A fórmula de Haversine é implementada manualmente, com as coordenadas convertidas para radianos e o raio da Terra fixo em **6.371.000 m**. Um encontro ocorre quando a distância é **estritamente menor que 20 m**.

### 4. Classificação do encontro

Cada encontro recebe um único tipo, verificado nesta ordem de prioridade:

1. **`protetiva`**: um dos dois tem `medidaProtetiva = true` e o id do outro está em `idsRestricaoMedida` (verificado nos dois sentidos do par).
2. **`faccao`**: os dois têm `faccaoMonitorado` preenchido e igual.
3. **`generico`**: qualquer outro encontro.

## Validação

- `respostas1.json` e `respostas2.json` gerados são equivalentes aos gabaritos fornecidos. A única diferença é no último dígito de alguns floats de `distanciaMetros`, causada pela forma como o JavaScript arredonda números de ponto flutuante.
- Os resultados de todos os datasets foram conferidos com uma implementação independente (Python), sem divergências.

  
| Dataset | Linhas  | Encontros | Tempo aprox. |
|---------|---------|-----------|--------------|
| 1       | 5 mil   | 4         | 30 ms        |
| 2       | 25 mil  | 6         | 40 ms        |
| 3       | 100 mil | 10        | 150 ms       |
| 4       | 400 mil | 15        | 0,6 s        |
| 5       | 1 mi    | 21        | 1,1 s        |
| 6       | 8 mi    | 27        | 7,7 s        |
| 7       | 12 mi   | 35        | 12,2 s       |

Os tempos são indicativos e variam conforme a máquina.

## Por que esta abordagem

- **Correção:** comparar só dentro do mesmo timestamp é exatamente a regra do desafio, e a comparação de todos os pares do grupo garante que nenhum encontro seja perdido.
- **Memória constante:** processar um timestamp por vez permite rodar datasets de qualquer tamanho sem aumentar o heap do Node.
- **Desempenho:** o agrupamento por timestamp evita comparar todos os registros entre si (O(n²) sobre o arquivo inteiro). O pré-filtro de latitude descarta a maioria dos pares antes do cálculo trigonométrico. A leitura em uma única passada aproveita bem o I/O em stream do Node.
- **Simplicidade:** sem dependências externas em tempo de execução, e cada regra de negócio fica numa função pequena e fácil de testar (`calcularDistancia`, `classificarEncontro`, `detectarEncontros`).
