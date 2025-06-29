/** *************************************************************************************
   
    * @file        bot.js
    * @brief       Main bot controller and initialization system for Minecraft automation
    * @author      Agustín I. Galdeman
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-07
    * @version     2.0 - Fixed duplicated bot start

    ************************************************************************************* */

/* **************************************************************************************
    * INCLUDES AND DEPENDENCIES *
   ************************************************************************************** */

const mineflayer = require('mineflayer');
const {pathfinder, Movements} = require('mineflayer-pathfinder');
const {mineflayer: mineflayerViewer} = require('prismarine-viewer');

const BotActions = require('./actions');
const NavigationStateMachine = require('./behaviors');


/* **************************************************************************************
    * CONSTANTS AND STATIC DATA *
   ************************************************************************************** */

// Bot connection and authentication configuration
const BOT_CONFIG =
{
    host: 'localhost',
    port: 25565,
    username: 'JSBot',
    version: '1.21.4'
};

// 3D viewer web interface configuration
const VIEWER_CONFIG =
{
    port: 3007,
    firstPerson: false
};

// Connection timeout duration in milliseconds
const CONNECTION_TIMEOUT = 30000;


/* **************************************************************************************
    * CLASS IMPLEMENTATIONS *
   ************************************************************************************** */

/**
 * @class MinecraftBot
 * @brief Main bot controller handling connection, initialization, and autonomous operation
 */
class MinecraftBot
{
    /**
     * @brief Constructor initializes bot controller with default state
     */
    constructor()
    {
        this.bot = null;
        this.actions = null;
        this.stateMachine = null;
        this.isReady = false;
        this.viewerStarted = false;
    }

    //* CONNECTION AND INITIALIZATION

    /**
     * @brief Establishes connection to Minecraft server and initializes bot systems
     * @returns {Promise<MinecraftBot>} Promise resolving to initialized bot instance
     * @throws {Error} If connection fails or times out
     */
    async start()
    {
        console.log('Creating Minecraft bot...');
        
        this.bot = mineflayer.createBot(BOT_CONFIG);
        this.bot.loadPlugin(pathfinder);
        this.setupEvents();
        
        return new Promise((resolve, reject) =>
        {
            this.bot.once('spawn', () => {resolve(this);});
            
            this.bot.on('error', (err) => 
            {
                console.error('Bot error:', err);
                reject(err);
            });

            setTimeout(() => 
            {
                if (!this.isReady)
                {reject(new Error('Bot connection timeout'));}
            }, CONNECTION_TIMEOUT);
        });
    }

    /**
     * @brief Configures bot event handlers for connection lifecycle management
     */
    setupEvents()
    {
        this.bot.on('login', () =>
        {console.log(`Bot logged in as ${this.bot.username}`);});

        this.bot.once('spawn', () => {this.onSpawn();});

        this.bot.on('end', () =>
        {
            console.log('Bot disconnected from server');
            this.isReady = false;
            this.viewerStarted = false;
        });
    }

    /**
     * @brief Handles bot spawn event with system initialization and autonomous mode startup
     */
    onSpawn() {
        if (this.isReady)
        {
            console.log('onSpawn called but bot is already ready, skipping...');
            return;
        }

        console.log('Bot spawned successfully');
        
        if (!this.viewerStarted)
        {
            this.setupViewer();
        }
        
        this.actions = new BotActions(this.bot);
        this.stateMachine = new NavigationStateMachine(this.bot, this.actions);
        
        this.isReady = true;
    }

    /**
     * @brief Initializes 3D web viewer for bot monitoring and debugging
     */
    setupViewer()
    {
        if (this.viewerStarted)
        {
            console.log('Viewer already started, skipping...');
            return;
        }

        try
        {
            mineflayerViewer(this.bot, VIEWER_CONFIG);
            console.log(`3D Viewer started at http://localhost:${VIEWER_CONFIG.port}`);
            this.viewerStarted = true;
        }
        
        catch (error)
        {
            console.error('Failed to start viewer:', error);
        }
    }
}


/* **************************************************************************************
    * MAIN EXECUTION FUNCTIONS *
   ************************************************************************************** */

/**
 * @brief Main application entry point with error handling and graceful shutdown
 */
async function main()
{
    try
    {
        const minecraftBot = new MinecraftBot();
        await minecraftBot.start();
        
        process.on('SIGINT', () =>
        {
            console.log('\nShutting down bot...');
            if (minecraftBot.stateMachine)
            {
                minecraftBot.stateMachine.stop();
            }
            
            if (minecraftBot.bot)
            {
                minecraftBot.bot.quit();
            }
            process.exit(0);
        });
    }
    
    catch (error)
    {
        console.error('Failed to start bot:', error);
        process.exit(1);
    }
}

if (require.main === module) 
{
    main();
}

module.exports = MinecraftBot;
