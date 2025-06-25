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

// Available movement directions
const DIRECTIONS = ['north', 'south', 'east', 'west'];

// Direction mappings for front position calculation
const DIRECTION_OFFSETS = {
    north: { x: 0, z: -1 },
    south: { x: 0, z: 1 },
    west: { x: -1, z: 0 },
    east: { x: 1, z: 0 }
};


/* **************************************************************************************
    * CLASS IMPLEMENTATIONS *
   ************************************************************************************** */

/**
 * @class AutonomousBot
 * @brief State machine for autonomous movement with obstacle detection
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
        this.currentDirection = 'west';
        this.isRunning = false;
        
        // Obstacle detection flags
        this.feetBlocked = false;
        this.headBlocked = false;
        this.aboveBlocked = false;
        
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
                // Reset flags and scan environment
                this.resetFlags();
                this.scanEnvironment();
                
                // Execute state machine
                await this.executeStateMachine();
                
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
     * @brief Resets all obstacle detection flags
     */
    resetFlags()
    {
        this.feetBlocked = false;
        this.headBlocked = false;
        this.aboveBlocked = false;
    }

    /**
     * @brief Scans three blocks in front of bot (feet, head, above)
     */
    scanEnvironment()
    {
        const pos = this.actions.position();
        const offset = DIRECTION_OFFSETS[this.currentDirection];
        const frontPos = { x: pos.x + offset.x, z: pos.z + offset.z };
        
        let solidBlocks = 0;

        // Check feet level (same Y as bot)
        const feetBlock = this.actions.block_at(frontPos.x, pos.y, frontPos.z);
        if (feetBlock && feetBlock.name !== 'air')
        {
            this.feetBlocked = true;
            solidBlocks++;
        }

        // Check head level (Y + 1)
        const headBlock = this.actions.block_at(frontPos.x, pos.y + 1, frontPos.z);
        if (headBlock && headBlock.name !== 'air')
        {
            this.headBlocked = true;
            solidBlocks++;
        }

        // Check above head level (Y + 2)
        const aboveBlock = this.actions.block_at(frontPos.x, pos.y + 2, frontPos.z);
        if (aboveBlock && aboveBlock.name !== 'air')
        {
            this.aboveBlocked = true;
            solidBlocks++;
        }

        if (solidBlocks > 0)
        {
            console.log(`Environment scan: ${solidBlocks} solid blocks detected`);
        }
    }

    /**
     * @brief Executes state machine logic based on obstacle flags
     */
    async executeStateMachine()
    {
        switch (this.currentState)
        {
            case 'MOVING':
                if (this.headBlocked)
                {
                    // Change direction if head is blocked
                    await this.changeDirection();
                }
                else if (this.feetBlocked && !this.headBlocked && !this.aboveBlocked)
                {
                    // Jump if only feet blocked
                    this.actions.jump();
                    await this.actions.step(this.currentDirection);
                }
                else
                {
                    // Normal movement
                    await this.actions.step(this.currentDirection);
                }
                break;
        }
    }

    /**
     * @brief Changes bot direction to next available direction
     */
    async changeDirection()
    {
        const currentIndex = DIRECTIONS.indexOf(this.currentDirection);
        const nextIndex = (currentIndex + 1) % DIRECTIONS.length;
        const newDirection = DIRECTIONS[nextIndex];
        
        console.log(`Changing direction from ${this.currentDirection} to ${newDirection}`);
        
        this.currentDirection = newDirection;
        
        // Update bot's look direction
        const directionMappings = {
            north: Math.PI,
            south: 0,
            west: Math.PI / 2,
            east: -Math.PI / 2
        };
        
        await this.actions.look(directionMappings[newDirection]);
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