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
    {x: -640, y: 68, z: 136, type: 'block_to_dig'},
    {x: -700, y: 63, z: 145, type: 'first_checkpoint'},
    {x: -722, y: 63, z: 145, type: 'bridge_start'},
    {x: -735, y: 63, z: 145, type: 'bridge_end'},
    {x: -750, y: 63, z: 145, type: 'second_checkpoint'},
    {x: -791, y: 103, z: 152, type: 'final-location'},
    {x: -750, y: 63, z: 145, type: 'second_checkpoint'},
    {x: -735, y: 63, z: 145, type: 'bridge_end'},
    {x: -722, y: 63, z: 145, type: 'bridge_start'},
    {x: -700, y: 63, z: 145, type: 'first_checkpoint'},
    {x: -640, y: 71, z: 128, type: 'spawn'},
    {x: -638, y: 68, z: 141, type: 'chest_location'}
];


/* **************************************************************************************
    * MAIN CLASS IMPLEMENTATION *
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

    //* MOVEMENT ACTIONS

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

            case 'MINING':
                await this.handleMining();
                break;
            
            case 'SEARCHING_CHEST':
                await this.handleSearchingChest();
                break;

            case 'MANAGE_CHEST':
                await this.handleManagingChest();
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

            // Check if bot is at first goal
            if (this.currentGoalIndex == 0)
            {
                this.currentState = 'MINING'
                return;
            }
            
            // Move to next goal in sequence
            this.currentGoalIndex++;
            
            // Check if all goals completed
            if (this.currentGoalIndex >= GOAL_SEQUENCE.length)
            {
                console.log('All navigation goals completed');
                this.currentState = 'SEARCHING_CHEST';
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
                this.pathfinder.completeStep(movement.direction);
                break;
                
            case 'move':
                await this.actions.step(movement.direction);
                this.pathfinder.completeStep(movement.direction);
                break;
            
            // Bot is idle - either goal reached or impassable obstacle
            case 'idle':
                break;
        }
    }

    //* WORLD INTERACTIONS 

    /**
     * @brief Handles chest searching
     */
    async handleSearchingChest()
    {
        // Search for chest blocks
        const chest = this.actions.find_block('chest', 16);
        
        if (chest)
        {
            console.log(`Found chest at (${chest.x}, ${chest.y}, ${chest.z})`);
            this.currentState = 'MANAGE_CHEST';
        }

        else
        {
            console.log('No chest found');
            await this.stop;
        }
    }

    /**
     * @brief Handles chest management (open, collect, close, report)
     */
    async handleManagingChest()
    {
        try
        {
            // Open chest
            console.log('Opening chest...');
            await this.actions.openChestAt(this.chest.x, this.chest.y, this.chest.z);
            
            // Get chest contents
            const contents = this.actions.getChestContents();
            console.log(`Found ${contents.length} items in chest`);
            
            // Store collected items for reporting
            this.collectedItems = contents.map(item => `${item.count}x ${item.name}`);
            
            // Close chest
            this.actions.closeChest();
            console.log('Chest closed');
            
            // Report collected items
            if (this.collectedItems.length > 0)
            {
                const itemList = this.collectedItems.join(', ');
                this.actions.chat(`Items collected: ${itemList}`);
            }

            else
            {
                this.actions.chat('Chest was empty');
            }

            console.log('All tasks completed');
            this.stop;
        }

        catch (error)
        {
            console.log(`Chest management error: ${error.message}`);
            this.stop;
        }
    }

    /**
     * @brief Handles mining operations
     */
    async handleMining()
    {
        // Example logic, not implemented in the states machine flow
        try
        {
            const pos = this.actions.position();
            const nextBlock = this.actions.block_at(pos.x, pos.y, pos.z + 1);
            
            if (nextBlock && nextBlock.name !== 'air' && nextBlock.name !== 'bedrock')
            {
                console.log(`Mining block: ${nextBlock.name}`);
                await this.actions.dig_block(pos.x, pos.y, pos.z + 1);
            }
            
            // Move to next goal in sequence
            this.currentGoalIndex++;
            this.currentState = 'MOVING_TO_GOAL';
        }

        catch (error)
        {
            console.log(`Mining error: ${error.message}`);
            this.currentState = 'MOVING_TO_GOAL';
        }
    }

    //* ADITIONAL UTILITIES

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
