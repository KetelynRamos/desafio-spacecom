import * as fs from 'fs';
import * as readline from 'readline';
import { once } from 'events';


interface Posicionamento {
    idMonitorado: number;
    faccaoMonitorado: string;
    timestamp: string;
    latitude: number;
    longitude: number;
    medidaProtetiva: boolean;
    idsRestricaoMedida: number[];
}

interface Encontro {
    tipo: string;
    monitoradosEncontro: number[];
    timestamp: string;
    posicoes: {
        [id: number]: { lat: number; lon: number }
    };
    distanciaMetros: number;
}

const RAIO_TERRA = 6371000;
const DISTANCIA_LIMITE = 20;
const GRAUS_PARA_RAD = Math.PI / 180;

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = (lat2 - lat1) * GRAUS_PARA_RAD;
    const dLon = (lon2 - lon1) * GRAUS_PARA_RAD;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * GRAUS_PARA_RAD) * Math.cos(lat2 * GRAUS_PARA_RAD) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return RAIO_TERRA * c;
}

function classificarEncontro(p1: Posicionamento, p2: Posicionamento): string {
    const p1Agressor = p2.medidaProtetiva && p2.idsRestricaoMedida.includes(p1.idMonitorado);
    const p2Agressor = p1.medidaProtetiva && p1.idsRestricaoMedida.includes(p2.idMonitorado);

    if (p1Agressor || p2Agressor) {
        return 'protetiva';
    }
    if (p1.faccaoMonitorado !== '' && p1.faccaoMonitorado === p2.faccaoMonitorado) {
        return 'faccao';
    }
    return 'generico';
}

// Compara todos os pares de um único timestamp e acumula os encontros encontrados.
function detectarEncontros(horario: string, pessoas: Posicionamento[], encontros: Encontro[]): void {
    for (let i = 0; i < pessoas.length; i++) {
        const p1 = pessoas[i]!;
        for (let j = i + 1; j < pessoas.length; j++) {
            const p2 = pessoas[j]!;

            // Pré-filtro exato: a distância de Haversine nunca é menor que R * |dLat|.
            // Se só a diferença de latitude já passa de 20 m, o par não é encontro.
            if (RAIO_TERRA * Math.abs(p2.latitude - p1.latitude) * GRAUS_PARA_RAD >= DISTANCIA_LIMITE) {
                continue;
            }

            const distancia = calcularDistancia(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
            if (distancia < DISTANCIA_LIMITE) {
                encontros.push({
                    tipo: classificarEncontro(p1, p2),
                    monitoradosEncontro: [p1.idMonitorado, p2.idMonitorado],
                    timestamp: horario,
                    posicoes: {
                        [p1.idMonitorado]: { lat: p1.latitude, lon: p1.longitude },
                        [p2.idMonitorado]: { lat: p2.latitude, lon: p2.longitude }
                    },
                    distanciaMetros: distancia
                });
            }
        }
    }
}

function lerLinha(linha: string): Posicionamento {
    const colunas = linha.split(';');
    const restricoes = colunas[6] ? colunas[6].replace(/"/g, '') : '';

    return {
        idMonitorado: Number(colunas[0]),
        faccaoMonitorado: colunas[1] ?? '',
        timestamp: (colunas[2] ?? '').replace(/"/g, ''),
        latitude: Number(colunas[3]),
        longitude: Number(colunas[4]),
        medidaProtetiva: colunas[5] === 'true',
        idsRestricaoMedida: restricoes ? restricoes.split(',').map(Number) : []
    };
}

// Os datasets vêm ordenados por timestamp. Por isso cada grupo é processado assim que
// o timestamp muda e depois descartado: só um timestamp fica em memória por vez.
async function processarDataset(numeroDataset: number): Promise<void> {
    const nomeArquivoInput = `dataset${numeroDataset}.txt`;
    const nomeArquivoOutput = `respostas${numeroDataset}.json`;

    if (!fs.existsSync(nomeArquivoInput)) {
        return;
    }

    console.log(`Processando ${nomeArquivoInput}...`);
    const inicio = process.hrtime.bigint();

    const rl = readline.createInterface({
        input: fs.createReadStream(nomeArquivoInput),
        crlfDelay: Infinity
    });

    const encontros: Encontro[] = [];
    let grupoAtual: Posicionamento[] = [];
    let horarioAtual = '';
    let isPrimeiraLinha = true;

    const fecharGrupo = () => {
        if (grupoAtual.length === 0) return;
        detectarEncontros(horarioAtual, grupoAtual, encontros);
        grupoAtual = [];
    };

    // O evento 'line' processa cada linha de forma síncrona assim que ela é lida,
    // sem enfileirar linhas em memória (como acontece com o `for await` do readline).
    rl.on('line', (linha) => {
        if (isPrimeiraLinha) {
            isPrimeiraLinha = false;
            return;
        }
        if (!linha) return;

        const p = lerLinha(linha);
        if (p.timestamp !== horarioAtual) {
            // O formato YYYY-MM-DD HH:MM:SS ordena corretamente como texto.
            if (p.timestamp < horarioAtual) {
                console.warn(`⚠️  ${nomeArquivoInput} não está ordenado por timestamp (${p.timestamp} após ${horarioAtual}).`);
            }
            fecharGrupo();
            horarioAtual = p.timestamp;
        }
        grupoAtual.push(p);
    });
    await once(rl, 'close');
    fecharGrupo();

    fs.writeFileSync(nomeArquivoOutput, JSON.stringify(encontros, null, 2));
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    console.log(`✅ ${encontros.length} encontros salvos em ${nomeArquivoOutput} (${ms.toFixed(0)} ms)\n`);
}

async function executarTudo() {
    console.log("Iniciando processamento em lote...\n");
    for (let i = 1; i <= 7; i++) {
        await processarDataset(i);
    }
    console.log("Todos os datasets foram processados com sucesso!");
}

executarTudo();
