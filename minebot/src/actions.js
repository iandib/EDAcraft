/** *************************************************************************************
   
    * @file        actions.js
    * @brief       Implementation of basic bot actions and world interaction system
    * @author      Agustín I. Galdeman
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-07
    * @version     2.0 - Fixed lookAt command

    ************************************************************************************* */


/* **************************************************************************************
    * INCLUDES AND DEPENDENCIES *
   ************************************************************************************** */

const { GoalBlock } = require('mineflayer-pathfinder').goals;
const { Vec3 } = require("vec3");


/* **************************************************************************************
    * CONSTANTS AND STATIC DATA *
   ************************************************************************************** */

// Direction mappings with movement offsets and yaw rotations
const DIRECTION_MAPPINGS =
{
    north: {x: 0, z: -1, yaw: Math.PI},
    south: {x: 0, z: 1, yaw: 0},
    west: {x: -1, z: 0, yaw: Math.PI/2},
    east: {x: 1, z: 0, yaw: -Math.PI/2}
};

// Default maximum distance for block searching operations
const DEFAULT_SEARCH_DISTANCE = 16;

// Jump control duration in milliseconds
const JUMP_DURATION = 500;


/* **************************************************************************************
    * CLASS IMPLEMENTATIONS *
   ************************************************************************************** */

/**
 * @class BotActions
 * @brief Provides basic movement, interaction and world query capabilities for the bot
 */
class BotActions
{
    /**
     * @brief Constructor initializes the bot actions system
     * @param {Object} bot - Mineflayer bot instance
     */
    constructor(bot)
    {
        this.bot = bot;
        this.chestWindow = null; // Keep reference to open chest
    }

    //* MOVEMENT AND NAVIGATION

    /**
     * @brief Executes a single step movement in a cardinal direction
     * @param {string} direction - Cardinal direction (north, south, east, west)
     * @returns {boolean} True if movement succeeded, false otherwise
     * @throws {Error} If invalid direction is provided
     */
    async step(direction)
    {
        if (!DIRECTION_MAPPINGS[direction]) throw new Error(`Invalid direction: ${direction}`);

        const offset = DIRECTION_MAPPINGS[direction];
        
        try
        {
            // Set bot orientation using lookAt with a target point
            const currentPos = this.bot.entity.position;
            const targetPoint = new Vec3(
                currentPos.x + offset.x,
                currentPos.y,
                currentPos.z + offset.z
            );
            
            await this.bot.lookAt(targetPoint, true);
            
            // Move forward with direct control, as pathfinder.goto() caused errors
            this.bot.setControlState('forward', true);
            
            // Movement duration - adjust as needed
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Stop movement
            this.bot.setControlState('forward', false);
            
            return true;
        }
        catch (error)
        {
            // Ensure movement is stopped even on error
            console.log('step error')
            this.bot.setControlState('forward', false);
            throw error;
        }
    }

    /**
     * @brief Executes a jump action with timed control state management
     * @returns {boolean} Always returns true after jump execution
     */
    jump()
    {
        this.bot.setControlState('jump', true);
        setTimeout(() => 
        {
            this.bot.setControlState('jump', false);
        }, JUMP_DURATION);
        return true;
    }

    //* VIEW AND ORIENTATION CONTROL

    /**
     * @brief Adjusts bot's viewing direction to look at a specific cardinal direction
     * @param {string} direction - Cardinal direction (north, south, east, west)
     * @param {boolean} force - Force immediate look without smooth transition
     * @returns {boolean} Always returns true after look completion
     */
    async lookAt(direction, force = true)
    {
        if (!DIRECTION_MAPPINGS[direction]) throw new Error(`Invalid direction: ${direction}`);
        
        const offset = DIRECTION_MAPPINGS[direction];
        const currentPos = this.bot.entity.position;

        // Convert direction to Vec3
        const targetPoint = new Vec3(
            currentPos.x + offset.x,
            currentPos.y,
            currentPos.z + offset.z
        );
        
        await this.bot.lookAt(targetPoint, force);
        return true;
    }

    //* POSITION AND WORLD QUERIES

    /**
     * @brief Retrieves bot's current floored position coordinates
     * @returns {Object} Position object with x, y, z integer coordinates
     */
    position()
    {
        const pos = this.bot.entity.position;
        return {
            x: Math.floor(pos.x),
            y: Math.floor(pos.y),
            z: Math.floor(pos.z)
        };
    }

    /**
     * @brief Retrieves spawn point coordinates
     * @returns {Object|null} Spawn point coordinates or null if not available
     */
    // Note: this method is unused, but could be useful for debugging
    spawnPoint()
    {
        if (this.bot.spawnPoint)
        {
            return {
                x: this.bot.spawnPoint.x,
                y: this.bot.spawnPoint.y,
                z: this.bot.spawnPoint.z
            };
        }
        return null;
    }

    /**
     * @brief Locates the nearest block of specified type within search radius
     * @param {string} blockType - Name of the block type to search for
     * @param {number} maxDistance - Maximum search distance (default: 16)
     * @returns {Object|null} Block information object or null if not found
     */
    find_block(blockType, maxDistance = DEFAULT_SEARCH_DISTANCE)
    {
        const block = this.bot.findBlock
        ({
            matching: (block) => block.name === blockType,
            maxDistance: maxDistance
        });
        
        if (block)
        {
            return {
                x: block.position.x,
                y: block.position.y,
                z: block.position.z,
                name: block.name
            };
        }
        
        return null;
    }

    /**
     * @brief Retrieves block information at specific world coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} z - Z coordinate
     * @returns {Object|null} Block information object or null if no block exists
     */
    block_at(x, y, z)
    {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (block)
        {
            return {
                name: block.name,
                type: block.type,
                position: { x, y, z },
                boundingBox: block.boundingBox
            };
        }
        return null;
    }

    //* WORLD INTERACTION COMMANDS

    /**
     * @brief Opens a chest at specified coordinates
     * @param {number} x - X coordinate of the chest
     * @param {number} y - Y coordinate of the chest
     * @param {number} z - Z coordinate of the chest
     * @returns {boolean} True if chest opened successfully
     * @throws {Error} If block is not found or cannot be opened as chest
     */
    async openChestAt(x, y, z)
    {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        
        if (!block)
        {
            throw new Error("Block not found at specified coordinates");
        }

        try
        {
            this.chestWindow = await this.bot.openChest(block);
            return true;
        }
        catch (error)
        {
            throw new Error(`Failed to open chest: ${error.message}`);
        }
    }

    /**
     * @brief Retrieves contents of currently open chest
     * @returns {Array} Array of items in the chest with slot, name, and count
     * @throws {Error} If no chest is currently open
     */
    getChestContents()
    {
        if (!this.chestWindow)
        {
            throw new Error("No chest is currently open");
        }

        return this.chestWindow.containerItems().map(item => ({
            slot: item.slot,
            name: item.name,
            count: item.count
        }));
    }

    /**
     * @brief Closes the currently open chest
     * @returns {boolean} True if chest was closed successfully
     * @throws {Error} If no chest is currently open
     */
    closeChest()
    {
        if (!this.chestWindow)
        {
            throw new Error("No chest is currently open");
        }

        this.chestWindow.close();
        this.chestWindow = null;
        return true;
    }

    /**
     * @brief Sends a message to the game chat
     * @param {string} message - Message to send to chat
     * @returns {boolean} Always returns true after sending message
     */
    chat(message)
    {
        this.bot.chat(message);
        return true;
    }

    /**
     * @brief Digs/breaks a block at specified coordinates
     * @param {number} x - X coordinate of the block to dig
     * @param {number} y - Y coordinate of the block to dig
     * @param {number} z - Z coordinate of the block to dig
     * @returns {boolean} True if block was successfully dug
     * @throws {Error} If block cannot be dug or is not found
     */
    async dig_block(x, y, z)
    {
        const blockToDig = this.bot.blockAt(new Vec3(x, y, z));

        if (!blockToDig)
        {
            throw new Error("Block not found at specified coordinates");
        }

        if (!this.bot.canDigBlock(blockToDig))
        {
            throw new Error("Cannot dig this block (protected or invalid)");
        }

        try
        {
            await this.bot.dig(blockToDig);
            return true;
        }
        catch (error)
        {
            throw new Error(`Failed to dig block: ${error.message}`);
        }
    }
}

module.exports = BotActions;