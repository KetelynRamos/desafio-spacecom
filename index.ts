import * as fs from 'fs';
import * as readline from 'readline';


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

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
              
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// --- FUNÇÃO ASSÍNCRONA COM LEITURA LINHA A LINHA ---
async function processarDataset(numeroDataset: number) {
    const nomeFicheiroInput = `dataset${numeroDataset}.txt`;
    const nomeFicheiroOutput = `respostas${numeroDataset}.json`;
    
    if (!fs.existsSync(nomeFicheiroInput)) {
        return;
    }

    console.log(`A processar ${nomeFicheiroInput} (leitura otimizada por stream)...`);
    
    const posicionamentos: Posicionamento[] = [];
    
    // Configura Stream
    const fileStream = fs.createReadStream(nomeFicheiroInput);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let isPrimeiraLinha = true;

    // 1. LER DADOS LINHA A LINHA )
    for await (const linha of rl) {
        if (isPrimeiraLinha) {
            isPrimeiraLinha = false;
            continue; 
        }
        if (!linha) continue;

        const colunas = linha.split(';');

        posicionamentos.push({
            idMonitorado: Number(colunas[0]),
            faccaoMonitorado: colunas[1],
            timestamp: colunas[2].replace(/"/g, ''),
            latitude: Number(colunas[3]),
            longitude: Number(colunas[4]),
            medidaProtetiva: colunas[5] === 'true',
            idsRestricaoMedida: colunas[6] ? colunas[6].replace(/"/g, '').split(',').map(Number) : []
        });
    }

    // 2. AGRUPAR POR TEMPO
    const posicoesPorTempo = new Map<string, Posicionamento[]>();
    for (const p of posicionamentos) {
        if (!posicoesPorTempo.has(p.timestamp)) {
            posicoesPorTempo.set(p.timestamp, []);
        }
        posicoesPorTempo.get(p.timestamp)!.push(p);
    }

    // 3. DETETAR ENCONTROS
    const encontrosDetetados: Encontro[] = [];
    for (const [horario, pessoas] of posicoesPorTempo.entries()) {
        for (let i = 0; i < pessoas.length; i++) {
            for (let j = i + 1; j < pessoas.length; j++) {
                const p1 = pessoas[i];
                const p2 = pessoas[j];
                const distancia = calcularDistancia(p1.latitude, p1.longitude, p2.latitude, p2.longitude);

                if (distancia < 20) {
                    let tipo = 'generico';
                    const p1Agressor = p2.medidaProtetiva && p2.idsRestricaoMedida.includes(p1.idMonitorado);
                    const p2Agressor = p1.medidaProtetiva && p1.idsRestricaoMedida.includes(p2.idMonitorado);
                    
                    if (p1Agressor || p2Agressor) {
                        tipo = 'protetiva';
                    } else if (p1.faccaoMonitorado !== '' && p1.faccaoMonitorado === p2.faccaoMonitorado) {
                        tipo = 'faccao';
                    }

                    encontrosDetetados.push({
                        tipo: tipo,
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


    fs.writeFileSync(nomeFicheiroOutput, JSON.stringify(encontrosDetetados, null, 2));
    console.log(`✅ Sucesso: encontros guardados em ${nomeFicheiroOutput}\n`);
}

async function executarTudo() {
    console.log("A iniciar processamento em lote...\n");
    for (let i = 1; i <= 7; i++) {
        await processarDataset(i);
    }
    console.log("Todos os datasets foram processados com sucesso!");
}

executarTudo();