/** *************************************************************************************
   
    * @file        behaviors.js
    * @brief       Autonomous movement state machine using pathfinder for navigation
    * @author      Agustín I. Galdeman
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-25
    * @version     3.0 - Refactored to use pathfinder module

    ************************************************************************************* */


/* **************************************************************************************
    * INCLUDES AND DEPENDENCIES *
   ************************************************************************************** */

const SimplePathfinder = require('./pathfinder');


/* **************************************************************************************
    * CONSTANTS AND STATIC DATA *
   ************************************************************************************** */

// Initial wait before starting autonomous behavior
const INITIAL_WAIT = 3000;

// Movement execution interval in milliseconds
const MOVEMENT_INTERVAL = 200;


/* **************************************************************************************
    * CLASS IMPLEMENTATIONS *
   ************************************************************************************** */

/**
 * @class AutonomousBot
 * @brief State machine for autonomous movement using pathfinder for navigation
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
        this.pathfinder = new SimplePathfinder(actions);
        this.currentState = 'MOVING';
        this.isRunning = false;
        
        // Start autonomous behavior after initial wait
        setTimeout(() => this.start(), INITIAL_WAIT);
    }

    /**
     * @brief Starts the autonomous movement state machine
     */
    start()
    {
        if (this.isRunning) return;
        
        this.isRunning = true;
        
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
     * @brief Executes state machine logic using pathfinder decisions
     */
    async executeStateMachine()
    {
        switch (this.currentState)
        {
            case 'MOVING':
                // Get movement decision from pathfinder
                const movement = this.pathfinder.getNextMovement();
                
                switch (movement.action)
                {
                    case 'change_direction':
                        await this.changeDirection(movement.newDirection);
                        break;
                        
                    case 'jump_and_move':
                        this.actions.jump();
                        await this.actions.step(movement.direction);
                        break;
                        
                    case 'move':
                        await this.actions.step(movement.direction);
                        break;
                }
                break;
        }
    }

    /**
     * @brief Changes bot direction to specified new direction
     * @param {string} newDirection - Direction to change to
     */
    async changeDirection(newDirection)
    {
        const currentDirection = this.pathfinder.getDirection();
        
        console.log(`Changing direction from ${currentDirection} to ${newDirection}`);
        
        // Update pathfinder direction
        this.pathfinder.setDirection(newDirection);
        
        // Update bot's look direction
        await this.actions.lookAt(newDirection);
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