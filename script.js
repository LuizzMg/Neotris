// --- CONSTANTES E CONFIGURAÇÃO INICIAL ---
const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30;

// --- ELEMENTOS DO DOM (HTML) ---
let music, canvas, nextCanvas, scoreCanvas, startButton, timerDisplay, muteButton, volumeSlider, pauseButton, pauseMenu, resumeButton;
let playerNameInput, highScoreDisplay;
let gameOverMenu, restartButton; // 

// --- Variáveis de Contexto 2D ---
let ctx, nextCtx, scoreCtx;

// --- CORES E FORMAS DAS PEÇAS ---
const COLORS = [
    null,       // 0: Vazio
    '#00ffff', // 1: I (Ciano)
    '#0000ff', // 2: J (Azul)
    '#ff7f00', // 3: L (Laranja)
    '#ffff00', // 4: O (Amarelo)
    '#00ff00', // 5: S (Verde)
    '#8000ff', // 6: T (Roxo)
    '#ff0000', // 7: Z (Vermelho)
];

const TETROMINOS = {
    I: [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
    J: [[2, 0, 0], [2, 0, 0], [2, 2, 0]],
    L: [[0, 0, 3], [0, 0, 3], [0, 3, 3]],
    O: [[4, 4], [4, 4]],
    S: [[0, 5, 5], [5, 5, 0], [0, 0, 0]],
    T: [[0, 6, 0], [6, 6, 6], [0, 0, 0]],
    Z: [[7, 7, 0], [0, 7, 7], [0, 0, 0]]
};

// --- ESTADO DO JOGO (Variáveis Globais) ---
const player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    nextMatrix: null,
    score: 0,
};

let board = createMatrix(COLS, ROWS);
let dropCounter = 0;
const dropInterval = 1000;
let lastFrameTime = 0;
let isPaused = true;
let animationFrameId = null;
let musicStarted = false;

// Variáveis do Contador de Tempo
let timerInterval = null;
let secondsElapsed = 0;

// Variáveis de Áudio
let isMuted = false;
let lastVolume = 0.3;

// --- Variáveis de Recorde (High Score) ---
let highScore = 0;
let highScoreName = "---";
let highScoreTime = 0; // Armazena o tempo do recorde
let currentPlayerName = "JOGADOR";

// --- FUNÇÕES DE LÓGICA DO JOGO ---

function createMatrix(w, h) {
    const m = [];
    while (h--) {
        m.push(new Array(w).fill(0));
    }
    return m;
}

function createPiece(type) {
    const matrix = TETROMINOS[type];
    return matrix.map(row => row.slice());
}

function collide(board, player) {
    const { matrix: m, pos: o } = player;
    for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m[y].length; x++) {
            if (m[y][x] !== 0 && (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function merge(board, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function clearLines() {
    outer: for (let y = board.length - 1; y >= 0; y--) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x] === 0) {
                continue outer;
            }
        }
        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        player.score += 10;
        y++;
    }
}

function rotate(matrix, dir) {
    const h = matrix.length;
    const w = matrix[0].length;
    const res = Array.from({ length: w }, () => Array(h).fill(0));
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (dir > 0) {
                res[x][h - 1 - y] = matrix[y][x];
            } else {
                res[w - 1 - x][y] = matrix[y][x];
            }
        }
    }
    return res;
}

// --- Funções de Recorde (High Score) ---

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return String(minutes).padStart(2, '0') + ':' +
           String(seconds).padStart(2, '0');
}

function loadHighScore() {
    const savedScore = localStorage.getItem('tetrisHighScore');
    const savedName = localStorage.getItem('tetrisHighScoreName');
    const savedTime = localStorage.getItem('tetrisHighScoreTime');

    if (savedScore) {
        highScore = parseInt(savedScore, 10);
    }
    if (savedName) {
        highScoreName = savedName;
    }
    if (savedTime) {
        highScoreTime = parseInt(savedTime, 10);
    }
}

function saveHighScore() {
    localStorage.setItem('tetrisHighScore', highScore);
    localStorage.setItem('tetrisHighScoreName', highScoreName);
    localStorage.setItem('tetrisHighScoreTime', highScoreTime);
}

function updateHighScoreDisplay() {
    if (!highScoreDisplay) return;

    const formattedTime = formatTime(highScoreTime);

    const newHTML = `
        <div class="score-entry">
            <span class="score-entry-title">Recorde:</span>
            <span class="score-entry-name">${highScoreName}</span>
            <span class="score-entry-score">(${highScore})</span>
            <span class="score-entry-time">${formattedTime}</span>
        </div>
    `;
    highScoreDisplay.innerHTML = newHTML;
}

function checkAndSaveHighScore() {
    if (player.score > highScore) {
        highScore = player.score;
        highScoreName = currentPlayerName;
        highScoreTime = secondsElapsed;
        saveHighScore();
        updateHighScoreDisplay();
    }
}

// --- FUNÇÕES DE CONTROLE DO JOGADOR ---

function playerRotate(dir) {
    const oldMatrix = player.matrix;
    const oldX = player.pos.x;
    const rotated = rotate(oldMatrix, dir);
    player.matrix = rotated;
    let offset = 1;
    while (collide(board, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > rotated[0].length) {
            player.matrix = oldMatrix;
            player.pos.x = oldX;
            return;
        }
    }
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(board, player)) {
        player.pos.x -= dir;
    }
}

function playerDrop() {
    player.pos.y++;
    if (collide(board, player)) {
        player.pos.y--;
        merge(board, player);
        clearLines();
        updateScore();
        spawnPiece();
    }
    dropCounter = 0;
}

// ============ CÓDIGO MODIFICADO ABAIXO (spawnPiece) ============
function spawnPiece() {
    const types = Object.keys(TETROMINOS);
    if (player.nextMatrix) {
        player.matrix = player.nextMatrix;
    } else {
        player.matrix = createPiece(types[Math.floor(Math.random() * types.length)]);
    }
    player.nextMatrix = createPiece(types[Math.floor(Math.random() * types.length)]);
    player.pos.y = 0;
    player.pos.x = (COLS / 2 | 0) - (player.matrix[0].length / 2 | 0);

    if (collide(board, player)) {
        // --- Lógica de Game Over ---
        checkAndSaveHighScore();
        board.forEach(row => row.fill(0));
        player.score = 0;
        updateScore();
        isPaused = true;
        
        if (pauseMenu && pauseMenu.open) {
            pauseMenu.close();
        }

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        secondsElapsed = 0;
        
        if (timerDisplay) timerDisplay.style.display = 'none';
        
        // --- MODIFICAÇÃO: Habilitar input e mostrar botão Iniciar ---
        // Habilita o campo de nome e foca nele
        if (playerNameInput) {
            playerNameInput.disabled = false;
            playerNameInput.focus(); // Foca no campo
            playerNameInput.select(); // Seleciona o texto atual
        }
        // Mostra o botão Iniciar principal novamente
        if (startButton) {
            startButton.style.display = 'flex'; 
        }
        // --- FIM DA MODIFICAÇÃO ---
        
        // --- Mostrar popup de Game Over ---
        if (gameOverMenu) {
            gameOverMenu.showModal(); // Mostra o popup de Fim de Jogo
        }
    }
}

// --- FUNÇÕES DE RENDERIZAÇÃO (DESENHO) ---

function drawMatrix(matrix, offset, context) {
    if (!context) return;
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = COLORS[value];
                context.shadowColor = COLORS[value];
                context.shadowBlur = 20;
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
                context.shadowBlur = 0;
                context.shadowColor = 'transparent';
            }
        });
    });
}

function draw() {
    if (!ctx || !nextCtx) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, COLS, ROWS);
    drawMatrix(board, { x: 0, y: 0 }, ctx);
    
    nextCtx.fillStyle = '#000';
    nextCtx.fillRect(0, 0, 5, 5);

    if (!isPaused) {
        drawMatrix(player.matrix, player.pos, ctx);
        drawMatrix(player.nextMatrix, { x: 0, y: 0 }, nextCtx);
    }
}

function updateScore() {
    if (!scoreCtx) return;
    scoreCtx.fillStyle = '#000';
    scoreCtx.fillRect(0, 0, scoreCanvas.width, scoreCanvas.height);
    scoreCtx.fillStyle = '#00ffff';
    scoreCtx.fillText(
        player.score,
        scoreCanvas.width / 2,
        scoreCanvas.height / 2
    );
}

function updateTimerDisplay() {
    if (!timerDisplay) return;
    timerDisplay.textContent = formatTime(secondsElapsed);
}

// --- FUNÇÕES DE CONTROLE DE ÁUDIO ---

function adjustVolume(event) {
    if (!music) return;
    const newVolume = parseFloat(event.target.value);
    
    if (newVolume > 0) {
        lastVolume = newVolume;
    }
    music.volume = newVolume;

    if (newVolume === 0) {
        isMuted = true;
        if (muteButton) muteButton.textContent = "SOM: OFF";
    } else {
        isMuted = false;
        if (muteButton) muteButton.textContent = "SOM: ON";
    }
}

function toggleMute() {
    if (!music) return;
    isMuted = !isMuted;
    if (isMuted) {
        music.volume = 0;
        if (muteButton) muteButton.textContent = "SOM: OFF";
        if (volumeSlider) volumeSlider.value = 0;
    } else {
        music.volume = lastVolume;
        if (muteButton) muteButton.textContent = "SOM: ON";
        if (volumeSlider) volumeSlider.value = lastVolume;
    }
}


// --- FUNÇÕES DE PAUSA ---

function pauseGame() {
    // Caso 1: O jogo está rodando ativamente (!isPaused)
    if (!isPaused) {
        isPaused = true;
        if (music) music.pause();
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        if (pauseMenu) pauseMenu.showModal();
    } 
    else if (isPaused && startButton && startButton.style.display !== 'none') {
        // Apenas mostre o menu
        if (pauseMenu) pauseMenu.showModal();
    }
}


function resumeGame() {
    // Se o botão Iniciar NÃO está visível (jogo pausado no meio da partida)
    if (startButton && startButton.style.display === 'none') {
        if (!isPaused) return; 
        isPaused = false;
        if (pauseMenu) pauseMenu.close();
        if (music && !isMuted) music.play();
        
        if (timerInterval) clearInterval(timerInterval); 
        timerInterval = setInterval(() => {
            secondsElapsed++;
            updateTimerDisplay();
        }, 1000);

        lastFrameTime = performance.now();
        update(lastFrameTime);
    } 
    // Se o botão Iniciar ESTÁ visível (pausado no menu inicial)
    else {
        if (pauseMenu) pauseMenu.close();
        // Apenas fecha o menu
    }
}


function togglePause() {
    if (isPaused) {
        resumeGame();
    } else {
        pauseGame();
    }
}

// --- LOOP PRINCIPAL E CONTROLES ---

function update(time = 0) {
    if (isPaused) return;
    const deltaTime = time - lastFrameTime;
    lastFrameTime = time;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }
    draw();
    animationFrameId = requestAnimationFrame(update);
}

document.addEventListener('keydown', e => {
    
    // Controle de Pausa (tecla 'p')
    // É uma boa prática verificar a pausa primeiro
    if (e.key === 'p') {
        e.preventDefault(); // Previne qualquer ação padrão da tecla 'p'
        
        // Se o botão "Iniciar" está escondido (style.display === 'none')
        if (startButton && startButton.style.display === 'none') {
            togglePause(); // Alterna entre pause e resume
        } 
        // Se o botão "Iniciar" NÃO está escondido
        else {
            pauseGame(); // Apenas chama o menu de pausa
        }
        return; // Já lidamos com a tecla 'p', podemos sair
    }
    
    // Controles do jogo (só funcionam se NÃO estiver pausado)
    if (isPaused) return; // Se estiver pausado, ignora as teclas de jogo abaixo

    // Lidamos com as teclas de jogo
    switch (e.key) {
        case 'ArrowLeft': 
            e.preventDefault(); 
            playerMove(-1); 
            break;
            
        case 'ArrowRight': 
            e.preventDefault(); 
            playerMove(1); 
            break;
            
        case 'ArrowDown': 
            e.preventDefault(); 
            playerDrop(); 
            break;
            
        case 'q': 
            e.preventDefault(); 
            playerRotate(-1); 
            break;
            
        case 'w':
        case 'ArrowUp': 
            e.preventDefault(); 
            playerRotate(1); 
            break;
    }
});


// ============ CÓDIGO MODIFICADO ABAIXO (startGame) ============
function startGame() {
    // Verificação de Nome Adicionada
    const rawName = playerNameInput ? playerNameInput.value.trim() : "";

    if (rawName === "") {
        alert("Por favor, digite seu nome para iniciar!");
        if (playerNameInput) {
            playerNameInput.focus(); // Foca no campo de nome
        }
        return; // Impede o início do jogo
    }

    // Se o nome for válido, define o nome do jogador
    currentPlayerName = rawName.toUpperCase();


    // Código original da função
    if (music && !musicStarted) {
        music.volume = isMuted ? 0 : lastVolume;
        music.play().catch(error => {
            console.warn("Música bloqueada pelo navegador. O usuário precisa clicar.");
        });
        musicStarted = true;
    } else if (music && !isMuted) {
        music.play();
    }

    isPaused = false; 

    if (pauseMenu && pauseMenu.open) {
        pauseMenu.close();
    }
    
    // MODIFICAÇÃO: Garante que o menu Game Over está fechado
    if (gameOverMenu && gameOverMenu.open) {
        gameOverMenu.close();
    }
    // FIM DA MODIFICAÇÃO

    if (startButton) startButton.style.display = 'none'; // Esconde o botão Iniciar
    if (timerDisplay) timerDisplay.style.display = 'flex';
    if (playerNameInput) playerNameInput.disabled = true;

    secondsElapsed = 0;
    updateTimerDisplay();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        secondsElapsed++;
        updateTimerDisplay();
    }, 1000);

    lastFrameTime = performance.now();
    if (!animationFrameId) {
        spawnPiece(); // Garante que uma nova peça é gerada ao (re)começar
        update(lastFrameTime);
    }
}

// --- PONTO DE ENTRADA PRINCIPAL ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. ENCONTRAR ELEMENTOS DO DOM ---
    music = document.getElementById('game-music');
    canvas = document.getElementById('tetris-field');
    nextCanvas = document.getElementById('next-preview');
    scoreCanvas = document.getElementById('score-preview');
    startButton = document.getElementById('start-button');
    timerDisplay = document.getElementById('timer-display');
    muteButton = document.getElementById('mute-button');
    volumeSlider = document.getElementById('volume-slider');
    pauseButton = document.getElementById('pause-button');
    pauseMenu = document.getElementById('pause-menu');
    resumeButton = document.getElementById('resume-button');
    
    playerNameInput = document.getElementById('player-name-input');
    highScoreDisplay = document.getElementById('high-score-display');

    // --- MODIFICAÇÃO: Encontrar elementos do popup Game Over ---
    gameOverMenu = document.getElementById('game-over-menu');
    restartButton = document.getElementById('restart-button');
    // --- FIM DA MODIFICAÇÃO ---


    // --- 2. INICIALIZAR CONTEXTOS DO CANVAS ---
    if (canvas) {
        ctx = canvas.getContext('2d');
        ctx.scale(BLOCK_SIZE, BLOCK_SIZE);
    } else {
        console.error("ERRO: Canvas #tetris-field não encontrado!");
    }

    if (nextCanvas) {
        nextCtx = nextCanvas.getContext('2d');
        const PREV_SCALE = nextCanvas.width / 5;
        nextCtx.scale(PREV_SCALE, PREV_SCALE);
    } else {
        console.error("ERRO: Canvas #next-preview não encontrado!");
    }

    if (scoreCanvas) {
        scoreCtx = scoreCanvas.getContext('2d');
        scoreCtx.fillStyle = '#00ffff';
        scoreCtx.textAlign = 'center';
        scoreCtx.textBaseline = 'center';
        scoreCtx.font = "2.5rem 'Press Start 2P'";
    } else {
        console.error("ERRO: Canvas #score-preview não encontrado!");
    }

    // --- 3. ADICIONAR LISTENERS (INICIALIZAÇÃO) ---
    if (startButton) {
        startButton.addEventListener('click', startGame);
    } else {
        console.error("ERRO: Botão #start-button não encontrado!");
    }
    
    if (playerNameInput) {
        playerNameInput.addEventListener('input', (e) => {
            currentPlayerName = e.target.value.trim().toUpperCase() || "JOGADOR";
        });
    } else {
        console.warn("AVISO: Campo #player-name-input não encontrado.");
    }

    // --- MODIFICAÇÃO: Adicionar listener para o botão Recomeçar ---
    if (restartButton) {
        restartButton.addEventListener('click', () => {
            // Apenas fecha o menu Game Over
            if (gameOverMenu) gameOverMenu.close();
            
            // Garante que o foco vá para o input de nome
            // para que o jogador possa trocá-lo antes de
            // clicar no botão "Iniciar" principal.
            if (playerNameInput) {
                playerNameInput.focus();
                playerNameInput.select();
            }
            
            // NÃO chamamos mais startGame() aqui.
        });
    } else {
        console.warn("AVISO: Botão #restart-button (do menu game-over) não encontrado.");
    }
    // --- FIM DA MODIFICAÇÃO ---

    // Seção de Áudio
    if (muteButton) {
        muteButton.addEventListener('click', toggleMute);
    } else {
        console.warn("AVISO: Botão #mute-button não encontrado.");
    }

    if (volumeSlider) {
        lastVolume = parseFloat(volumeSlider.value);
        if (lastVolume === 0) {
            isMuted = true;
        }
        if (muteButton) {
            muteButton.textContent = isMuted ? "SOM: OFF" : "SOM: ON";
        }
        if (music) {
            music.volume = lastVolume;
        }
        volumeSlider.addEventListener('input', adjustVolume);
    } else {
        console.warn("AVISO: Slider #volume-slider não encontrado!");
    }


    // Seção de Pause
    if (pauseButton) {
        pauseButton.addEventListener('click', pauseGame);
    } else {
        console.warn("AVISO: Botão #pause-button não encontrado.");
    }

    if (resumeButton) {
        resumeButton.addEventListener('click', resumeGame);
    } else {
        console.warn("AVISO: Botão #resume-button (dentro do dialog) não encontrado.");
    }

    if (pauseMenu) {
        pauseMenu.addEventListener('cancel', (event) => {
            event.preventDefault(); 
            if (startButton && startButton.style.display === 'none') {
                resumeGame(); 
            }
        });
    }

    // --- 4. LISTENERS DE POP-UPS ---
    const instructions = document.getElementById('instrucoes');
    const close_button = document.getElementById('close');
    
    setTimeout(() => {
        if (instructions) {
            instructions.showModal();
        }
    }, 1);
    
    if (close_button) {
        close_button.addEventListener('click', () => {
            if (instructions) instructions.close();
        });
    } else {
        console.warn("AVISO: Botão #close (para instruções) não encontrado.");
    }

    const configuracoes = document.getElementById('configuracoes');
    const config_open_button = document.getElementById('config');
    const config_close_button = document.getElementById('config-close-button');
    
    if (config_open_button) {
        config_open_button.addEventListener('click', () => {
            if (configuracoes) configuracoes.showModal();
        });
    } else {
        console.warn("AVISO: Botão #config (para abrir configs) não encontrado.");
    }
    
    if (config_close_button) {
        config_close_button.addEventListener('click', () => {
            if (configuracoes) configuracoes.close();
        });
    } else {
        console.warn("AVISO: Botão #config-close-button (para fechar configs) não encontrado.");
    }

    // --- 5. ESTADO INICIAL DO JOGO ---
    loadHighScore(); 
    updateHighScoreDisplay(); 
    spawnPiece();
    updateScore();
    draw();
});
