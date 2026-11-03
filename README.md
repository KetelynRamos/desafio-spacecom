Desafio Trainee Tech - Spacecom: Detecção de Encontros
Este repositório/pacote contém a solução para o desafio técnico de detecção de encontros físicos via geolocalização.

🚀 Tecnologias Utilizadas
Linguagem: TypeScript / Node.js

Motivação: A tipagem estática do TypeScript garante a integridade da estrutura dos dados (utilização de Interfaces rigorosas para Posicionamento e Encontro), prevenindo erros em tempo de execução. O Node.js oferece uma excelente performance nativa para operações de I/O e processamento assíncrono de ficheiros.

⚙️ Como Executar o Projeto
Certifique-se de ter o Node.js instalado no seu ambiente.

Na raiz do projeto, instale as dependências executando o comando:npm install

Coloque os 7 ficheiros oficiais de input (dataset1.txt a dataset7.txt) na mesma diretoria do ficheiro principal.

Execute o algoritmo principal com o comando:npx tsx index.ts

Os ficheiros JSON de output (respostas1.json a respostas7.json) serão gerados automaticamente na raiz da diretoria.

🧠 Lógica e Arquitetura da Solução
Para garantir a máxima eficiência térmica e um tempo de execução otimizado (critério de desempate), a solução foi estruturada em três pilares fundamentais:

Leitura Assíncrona por Streams (Otimização de Memória):
Para evitar o erro de limite de memória (ERR_STRING_TOO_LONG) ao processar ficheiros de input massivos (especificamente o dataset 7), foi utilizado o módulo nativo readline. A leitura do ficheiro é feita linha a linha sob demanda (Stream), mantendo o consumo de memória RAM extremamente baixo e estável.

Agrupamento Temporal via HashMap (Otimização de Processamento):
Para contornar o problema de uma verificação quadrática (O(n²)) em todo o dataset, os registos foram agrupados num Map utilizando o timestamp exato como chave. Desta forma, o algoritmo apenas invoca a fórmula matemática de distância para indivíduos que partilham o mesmo exato segundo temporal, reduzindo drasticamente o tempo total de processamento.

Cálculo de Distância e Regras de Negócio:

A Fórmula de Haversine foi aplicada manualmente, convertendo as coordenadas para radianos e fixando o raio da Terra em exatos 6.371.000 metros.

Os laços de repetição avançam sempre com j = i + 1, garantindo a unicidade do encontro (se A encontra B, o sistema não recalcula B encontrando A).

A classificação dos tipos de encontro (Protetiva, Facção e Genérico) obedece a uma cascata de validações booleanas com base nos campos medidaProtetiva e verificação de arrays de restrição.

