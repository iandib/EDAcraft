/** *************************************************************************************
   
    * @file        behaviors.js
    * @brief       Autonomous movement state machine for continuous bot navigation
    * @author      Agustín I. Galdeman
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-07
    * @version     2.0 - Simplified autonomous state machine

    ************************************************************************************* */


/* **************************************************************************************
    * CONSTANTS AND STATIC DATA *
   ************************************************************************************** */

// Movement execution interval in milliseconds
const MOVEMENT_INTERVAL = 200;

// Bot's movement direction
const MOVEMENT_DIRECTION = 'east';


/* **************************************************************************************
    * CLASS IMPLEMENTATIONS *
   ************************************************************************************** */

/**
 * @class AutonomousBot
 * @brief Single-state machine for continuous autonomous movement
 */
class AutonomousBot
{
    /**
     * @brief Constructor initializes and starts autonomous behavior
     * @param {Object} bot - Mineflayer bot instance
     * @param {Object} actions - BotActions instance for movement control
     */
    constructor(bot, actions)
    {
        this.bot = bot;
        this.actions = actions;
        this.currentState = 'MOVING';
        this.isRunning = false;
        
        // Start autonomous behavior immediately
        this.start();
    }

    /**
     * @brief Starts the autonomous movement state machine
     */
    start()
    {
        if (this.isRunning) return;
        
        this.isRunning = true;
        console.log('Starting autonomous movement');
        
        // Begin continuous movement loop
        this.movementLoop();
    }

    /**
     * @brief Main movement loop - executes continuously
     */
    async movementLoop()
    {
        while (this.isRunning)
        {
            try
            {
                // A. Scan environment
                this.scanEnvironment();
                
                // B. Move regardless of obstacles
                await this.executeMovement();
                
                // Wait before next cycle
                await this.sleep(MOVEMENT_INTERVAL);
            }
            catch (error)
            {
                console.log(`Movement error: ${error.message}`);
                await this.sleep(MOVEMENT_INTERVAL);
            }
        }
    }

    /**
     * @brief Scans blocks in front, left, and right of bot at feet and head level
     */
    scanEnvironment()
    {
        const pos = this.actions.position();
        let solidBlocks = 0;

        // Check front, left, right positions
        const positions = [
            { x: pos.x, z: pos.z - 1 },    // front (north)
            { x: pos.x - 1, z: pos.z },   // left (west)
            { x: pos.x + 1, z: pos.z }    // right (east)
        ];

        positions.forEach(scanPos =>
        {
            // Check feet level
            const feetBlock = this.actions.block_at(scanPos.x, pos.y, scanPos.z);
            if (feetBlock && feetBlock.name !== 'air')
            {
                solidBlocks++;
            }

            // Check head level
            const headBlock = this.actions.block_at(scanPos.x, pos.y + 1, scanPos.z);
            if (headBlock && headBlock.name !== 'air')
            {
                solidBlocks++;
            }
        });

        if (solidBlocks > 0)
        {
            console.log(`Environment scan: ${solidBlocks} solid blocks detected`);
        }
    }

    /**
     * @brief Executes movement step, never stops trying
     */
    async executeMovement()
    {
        try
        {
            await this.actions.step(MOVEMENT_DIRECTION);
        }
        catch (error)
        {
            // Continue trying regardless of failures
            console.log(`Step failed, continuing: ${error.message}`);
        }
    }

    /**
     * @brief Stops autonomous movement
     */
    stop()
    {
        this.isRunning = false;
        console.log('Stopping autonomous movement');
    }

    /**
     * @brief Promise-based delay utility
     * @param {number} ms - Delay in milliseconds
     * @returns {Promise} Promise that resolves after delay
     */
    sleep(ms)
    {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = AutonomousBot;