/** *************************************************************************************
   
    * @file        behaviors.js
    * @brief       Autonomous movement state machine using pathfinder for navigation
    * @author      Agustín I. Galdeman
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-25
    * @version     4.0 - Added chest management and mining states

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
const GOAL_SEQUENCE = [
    { x: -640, y: 71, z: 128, type: 'chest_location' },
    { x: -791, y: 103, z: 152, type: 'final_destination' }
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
        this.currentState = 'MOVING_TO_CHEST_AREA';
        this.isRunning = false;
        
        // Goal management
        this.currentGoalIndex = 0;
        this.currentGoal = GOAL_SEQUENCE[0];
        this.chestCoordinates = null;
        this.collectedItems = [];
        
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
        console.log(`Starting autonomous behavior - Goal: (${this.currentGoal.x}, ${this.currentGoal.y}, ${this.currentGoal.z})`);
        
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
            case 'MOVING_TO_CHEST_AREA':
                await this.handleMovingToChestArea();
                break;
                
            case 'SEARCHING_CHEST':
                await this.handleSearchingChest();
                break;
                
            case 'MOVING_TO_CHEST':
                await this.handleMovingToChest();
                break;
                
            case 'MANAGING_CHEST':
                await this.handleManagingChest();
                break;
                
            case 'MOVING_TO_FINAL':
                await this.handleMovingToFinal();
                break;
                
            case 'MINING':
                await this.handleMining();
                break;
                
            case 'COMPLETED':
                console.log('All tasks completed!');
                this.stop();
                break;
        }
    }

    /**
     * @brief Handles movement to chest area
     */
    async handleMovingToChestArea()
    {
        if (this.pathfinder.hasReachedGoal())
        {
            console.log('Reached chest area, searching for chest...');
            this.currentState = 'SEARCHING_CHEST';
            return;
        }

        // Execute pathfinder movement
        const movement = this.pathfinder.getNextMovement();
        await this.executeMovement(movement);
    }

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
            this.chestCoordinates = chest;
            
            // Set new goal to chest coordinates
            this.pathfinder.setGoal(chest.x, chest.y, chest.z);
            this.currentState = 'MOVING_TO_CHEST';
        }
        else
        {
            console.log('No chest found, continuing search...');
            // Keep moving around to search
            const movement = this.pathfinder.getNextMovement();
            await this.executeMovement(movement);
        }
    }

    /**
     * @brief Handles movement to chest
     */
    async handleMovingToChest()
    {
        if (this.pathfinder.hasReachedGoal())
        {
            console.log('Reached chest, starting chest management...');
            this.currentState = 'MANAGING_CHEST';
            return;
        }

        // Execute pathfinder movement
        const movement = this.pathfinder.getNextMovement();
        await this.executeMovement(movement);
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
            await this.actions.openChestAt(this.chestCoordinates.x, this.chestCoordinates.y, this.chestCoordinates.z);
            
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
            
            // Move to next goal
            this.currentGoalIndex++;
            if (this.currentGoalIndex < GOAL_SEQUENCE.length)
            {
                this.currentGoal = GOAL_SEQUENCE[this.currentGoalIndex];
                this.pathfinder.setGoal(this.currentGoal.x, this.currentGoal.y, this.currentGoal.z);
                this.currentState = 'MOVING_TO_FINAL';
                console.log(`Moving to final destination: (${this.currentGoal.x}, ${this.currentGoal.y}, ${this.currentGoal.z})`);
            }
            else
            {
                this.currentState = 'COMPLETED';
            }
        }
        catch (error)
        {
            console.log(`Chest management error: ${error.message}`);
            this.actions.chat(`Error managing chest: ${error.message}`);
            
            // Move to next goal anyway
            this.currentGoalIndex++;
            if (this.currentGoalIndex < GOAL_SEQUENCE.length)
            {
                this.currentGoal = GOAL_SEQUENCE[this.currentGoalIndex];
                this.pathfinder.setGoal(this.currentGoal.x, this.currentGoal.y, this.currentGoal.z);
                this.currentState = 'MOVING_TO_FINAL';
            }
            else
            {
                this.currentState = 'COMPLETED';
            }
        }
    }

    /**
     * @brief Handles movement to final destination
     */
    async handleMovingToFinal()
    {
        if (this.pathfinder.hasReachedGoal())
        {
            console.log('Reached final destination!');
            this.actions.chat('Reached final destination!');
            this.currentState = 'COMPLETED';
            return;
        }

        // Execute pathfinder movement
        const movement = this.pathfinder.getNextMovement();
        await this.executeMovement(movement);
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
            const blockBelow = this.actions.block_at(pos.x, pos.y - 1, pos.z);
            
            if (blockBelow && blockBelow.name !== 'air' && blockBelow.name !== 'bedrock')
            {
                console.log(`Mining block: ${blockBelow.name}`);
                await this.actions.dig_block(pos.x, pos.y - 1, pos.z);
                this.actions.chat(`Mined: ${blockBelow.name}`);
            }
            
            // Continue with other states
            this.currentState = 'MOVING_TO_FINAL';
        }
        catch (error)
        {
            console.log(`Mining error: ${error.message}`);
            this.currentState = 'MOVING_TO_FINAL';
        }
    }

    /**
     * @brief Executes movement commands from pathfinder
     * @param {Object} movement - Movement object from pathfinder
     */
    async executeMovement(movement)
    {
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