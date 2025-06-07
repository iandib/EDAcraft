const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const { mineflayer: mineflayerViewer } = require('prismarine-viewer');

const BotActions = require('./actions');
const NavigationStateMachine = require('./behaviors');

// Configuración del bot
const BOT_CONFIG = {
    host: 'localhost',
    port: 25565,
    username: 'JSBot',
    version: '1.21.4'
};

// Configuración del viewer
const VIEWER_CONFIG = {
    port: 3007,
    firstPerson: false
};

class MinecraftBot {
    constructor() {
        this.bot = null;
        this.actions = null;
        this.stateMachine = null;
        this.isReady = false;
        this.viewerStarted = false;
    }

    async start() {
        console.log('Creating Minecraft bot...');
        
        // Crear el bot
        this.bot = mineflayer.createBot(BOT_CONFIG);
        
        // Cargar plugins
        this.bot.loadPlugin(pathfinder);
        
        // Configurar eventos
        this.setupEvents();
        
        return new Promise((resolve, reject) => {
            this.bot.once('spawn', () => {
                resolve(this);
            });
            
            this.bot.on('error', (err) => {
                console.error('Bot error:', err);
                reject(err);
            });

            // Timeout de conexión
            setTimeout(() => {
                if (!this.isReady) {
                    reject(new Error('Bot connection timeout'));
                }
            }, 30000);
        });
    }

    setupEvents() {
        // Evento cuando el bot se conecta
        this.bot.on('login', () => {
            console.log(`Bot logged in as ${this.bot.username}`);
        });

        // Evento cuando el bot hace spawn
        this.bot.once('spawn', () => {
            this.onSpawn();
        });

        // Evento cuando el bot se desconecta
        this.bot.on('end', () => {
            console.log('Bot disconnected from server');
            this.isReady = false;
            this.viewerStarted = false;
        });

        // Evento cuando el bot recibe daño
        this.bot.on('health', () => {
            if (this.bot.health < 20) {
                console.log(`Health: ${this.bot.health}/20, Food: ${this.bot.food}/20`);
            }
        });
    }

    onSpawn() {
        if (this.isReady) {
            console.log('onSpawn called but bot is already ready, skipping...');
            return;
        }

        console.log('Bot spawned successfully!');
        
        // 1. Configurar movimiento
        this.setupMovement();
        
        // 2. Configurar viewer
        if (!this.viewerStarted) {
            this.setupViewer();
        }
        
        // 3. Inicializar sistemas
        this.actions = new BotActions(this.bot);
        this.stateMachine = new NavigationStateMachine(this.bot, this.actions);
        
        this.isReady = true;
        
        console.log('Bot initialization complete. Starting autonomous navigation...');
        
        // Iniciar navegación autónoma después de un breve delay
        setTimeout(() => {
            this.startAutonomousMode();
        }, 2000);
    }

    setupMovement() {
        const movements = new Movements(this.bot);
        
        // Configuración básica de movimiento
        movements.scafoldingBlocks = [];
        movements.allow1by1towers = false;
        movements.canDig = false;
        movements.allowWalkOnWater = false;
        movements.allowSwimming = false;
        movements.allowParkour = false;
        movements.allowSprinting = false;
        
        this.bot.pathfinder.setMovements(movements);
        console.log('Movement system configured');
    }

    setupViewer() {
        if (this.viewerStarted) {
            console.log('Viewer already started, skipping...');
            return;
        }

        try {
            console.log('Starting 3D viewer...');
            mineflayerViewer(this.bot, VIEWER_CONFIG);
            console.log(`3D Viewer started at http://localhost:${VIEWER_CONFIG.port}`);
            this.viewerStarted = true;
        } catch (error) {
            console.error('Failed to start viewer:', error);
        }
    }

    startAutonomousMode() {
        console.log('Starting autonomous navigation mode...');
        this.stateMachine.start('north');
    }
}

// Función principal
async function main() {
    try {
        const minecraftBot = new MinecraftBot();
        await minecraftBot.start();
        
        console.log('Bot is running autonomously! Press Ctrl+C to stop.');
        console.log(`3D Viewer available at http://localhost:${VIEWER_CONFIG.port}`);
        
        // Manejar cierre graceful
        process.on('SIGINT', () => {
            console.log('\nShutting down bot...');
            if (minecraftBot.stateMachine) {
                minecraftBot.stateMachine.stop();
            }
            if (minecraftBot.bot) {
                minecraftBot.bot.quit();
            }
            process.exit(0);
        });
        
    } catch (error) {
        console.error('Failed to start bot:', error);
        process.exit(1);
    }
}

// Ejecutar si este archivo se ejecuta directamente
if (require.main === module) {
    main();
}

module.exports = MinecraftBot;