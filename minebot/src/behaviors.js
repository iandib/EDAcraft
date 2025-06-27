/** *************************************************************************************
   
    * @file        behaviors.js
    * @brief       Autonomous movement state machine using pathfinder for navigation
    * @author      Agustín I. Galdeman
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-25
    * @version     3.0 - Added goal-based pathfinding support

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

// Goal coordinates sequence
const GOAL_SEQUENCE =
[
    // {x: -638, y: 68, z: 141, type: 'chest_location'},
    {x: -700, y: 63, z: 145, type: 'first_checkpoint'},
    {x: -722, y: 63, z: 145, type: 'bridge_start'},
    {x: -735, y: 63, z: 145, type: 'bridge_end'},
    {x: -750, y: 63, z: 145, type: 'second_checkpoint'},
    {x: -791, y: 103, z: 152, type: 'final-location'}
];


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
        this.currentState = 'MOVING_TO_GOAL';
        this.isRunning = false;
        
        // Goal management
        this.currentGoalIndex = 0;
        this.currentGoal = GOAL_SEQUENCE[0];
        
        // Set initial goal
        this.pathfinder.setGoal(this.currentGoal.x, this.currentGoal.y, this.currentGoal.z);
        
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
     * @brief Executes state machine logic
     */
    async executeStateMachine()
    {
        switch (this.currentState)
        {
            case 'MOVING_TO_GOAL':
                await this.handleMovingToGoal();
                break;
        }
    }

    /**
     * @brief Handles movement to goal destination with sequential goal progression
     */
    async handleMovingToGoal()
    {
        // Check if current goal is reached using pathfinder's method
        if (this.pathfinder.isAtGoal())
        {
            console.log(`Reached goal ${this.currentGoalIndex + 1}: ${this.currentGoal.type}`);
            
            // Move to next goal in sequence
            this.currentGoalIndex++;
            
            // Check if all goals completed
            if (this.currentGoalIndex >= GOAL_SEQUENCE.length)
            {
                console.log('All goals completed!');
                //! Debería terminar la ejecución
                // this.currentState = 'COMPLETED';
                return;
            }
            
            // Set next goal
            this.currentGoal = GOAL_SEQUENCE[this.currentGoalIndex];
            console.log(`Setting next goal: ${this.currentGoal.type} at (${this.currentGoal.x}, ${this.currentGoal.y}, ${this.currentGoal.z})`);
            
            // Update pathfinder with new goal
            this.pathfinder.setGoal(this.currentGoal.x, this.currentGoal.y, this.currentGoal.z);
            
            // Small delay before continuing to next goal
            await this.sleep(1000);
            return;
        }

        // Execute pathfinder movement for current goal
        const movement = this.pathfinder.getNextMovement();
        await this.executeMovement(movement);
    }

    /**
     * @brief Executes movement commands from pathfinder
     * @param {Object} movement - Movement object from pathfinder
     */
    async executeMovement(movement)
    {
        switch (movement.action)
        {
            case 'jump_and_move':
                this.actions.jump();
                await this.actions.step(movement.direction);

                // Mark step as completed for goal-based movement
                if (this.pathfinder.isGoalMode)
                    {this.pathfinder.completeStep(movement.direction);}
                break;
                
            case 'move':
                await this.actions.step(movement.direction);
                
                // Mark step as completed for goal-based movement
                if (this.pathfinder.isGoalMode)
                    {this.pathfinder.completeStep(movement.direction);}
                break;
            
            // Bot is idle - either goal reached or impassable obstacle
            case 'idle':
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