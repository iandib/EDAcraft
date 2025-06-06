const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const { mineflayer: mineflayerViewer } = require('prismarine-viewer');

const BotActions = require('./actions');
const BotBehaviors = require('./behaviors');

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
        this.behaviors = null;
        this.isReady = false;
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
                this.onSpawn();
                resolve(this);
            });
            
            this.bot.on('error', (err) => {
                console.error('Bot error:', err);
                reject(err);
            });
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
        });

        // Evento cuando el bot recibe un mensaje de chat
        this.bot.on('chat', (username, message) => {
            if (username === this.bot.username) return;
            
            console.log(`<${username}> ${message}`);
            this.handleChatCommand(username, message);
        });

        // Evento cuando el bot recibe daño
        this.bot.on('health', () => {
            if (this.bot.health < 20) {
                console.log(`Health: ${this.bot.health}/20, Food: ${this.bot.food}/20`);
            }
        });
    }

    onSpawn() {
        console.log('Bot spawned successfully!');
        
        // Configurar movimiento
        this.setupMovement();
        
        // Inicializar sistemas
        this.actions = new BotActions(this.bot);
        this.behaviors = new BotBehaviors(this.bot, this.actions);
        
        // Configurar comportamientos defensivos
        this.behaviors.setupDefensiveBehavior();
        
        // Configurar viewer
        this.setupViewer();
        
        // Teleportarse al spawn point
        const spawnPos = this.bot.spawnPoint;
        this.bot.chat(`/tp @s ${spawnPos.x} ${spawnPos.y} ${spawnPos.z}`);
        
        // Anunciar que está listo
        this.bot.chat("JSBot is ready! Type 'help' for commands.");
        
        this.isReady = true;
        
        // Iniciar comportamiento por defecto (movimiento en línea recta)
        this.startDefaultBehavior();
    }

    setupMovement() {
        const mcData = require('minecraft-data')(this.bot.version);
        const movements = new Movements(this.bot);
        
        // Configuración de movimiento
        movements.scafoldingBlocks = [];
        movements.allow1by1towers = false;
        movements.canDig = false;
        movements.allowWalkOnWater = true;
        movements.allowSwimming = true;
        movements.allowParkour = false;
        movements.allowSprinting = false;
        movements.jumpCost = 1000;
        
        this.bot.pathfinder.setMovements(movements);
        console.log('Movement system configured');
    }

    setupViewer() {
        try {
            mineflayerViewer(this.bot, VIEWER_CONFIG);
            console.log(`3D Viewer started at http://localhost:${VIEWER_CONFIG.port}`);
        } catch (error) {
            console.warn('Failed to start viewer:', error.message);
        }
    }

    async startDefaultBehavior() {
        // Esperar un poco antes de empezar a moverse
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Starting default behavior: moving straight north');
        
        try {
            // Mover en línea recta hacia el norte por 10 pasos
            await this.behaviors.moveStraight('north', 10);
            
            // Después hacer un cuadrado
            console.log('Now moving in a square pattern');
            await this.behaviors.moveInSquare(5);
            
        } catch (error) {
            console.error('Error in default behavior:', error.message);
        }
    }

    handleChatCommand(username, message) {
        const cmd = message.toLowerCase().trim();
        
        switch (cmd) {
            case 'help':
                this.bot.chat('Commands: stop, north, south, east, west, square, explore, status, pos');
                break;
                
            case 'stop':
                this.behaviors.stop();
                this.bot.chat('Stopped current behavior');
                break;
                
            case 'north':
            case 'south':
            case 'east':
            case 'west':
                this.behaviors.stop();
                this.behaviors.moveStraight(cmd, 5).catch(err => {
                    this.bot.chat(`Cannot move ${cmd}: ${err.message}`);
                });
                break;
                
            case 'square':
                this.behaviors.stop();
                this.behaviors.moveInSquare(4).catch(err => {
                    this.bot.chat(`Cannot move in square: ${err.message}`);
                });
                break;
                
            case 'explore':
                this.behaviors.stop();
                this.behaviors.explore(30000).catch(err => {
                    this.bot.chat(`Cannot explore: ${err.message}`);
                });
                break;
                
            case 'status':
                const status = this.behaviors.getStatus();
                this.bot.chat(`Behavior: ${status.currentBehavior || 'none'}, Running: ${status.isRunning}`);
                break;
                
            case 'pos':
                const pos = this.actions.getPosition();
                this.bot.chat(`Position: ${pos.x}, ${pos.y}, ${pos.z}`);
                break;
        }
    }

    // Método para ejecutar comandos programáticamente
    async executeCommand(command, ...args) {
        if (!this.isReady) {
            throw new Error('Bot is not ready yet');
        }
        
        switch (command) {
            case 'move':
                return await this.behaviors.moveStraight(args[0], args[1] || 1);
            case 'square':
                return await this.behaviors.moveInSquare(args[0] || 4);
            case 'explore':
                return await this.behaviors.explore(args[0] || 30000);
            case 'stop':
                return this.behaviors.stop();
            default:
                throw new Error(`Unknown command: ${command}`);
        }
    }
}

// Función principal
async function main() {
    try {
        const minecraftBot = new MinecraftBot();
        await minecraftBot.start();
        
        console.log('Bot is running! Press Ctrl+C to stop.');
        
        // Manejar cierre graceful
        process.on('SIGINT', () => {
            console.log('\nShutting down bot...');
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