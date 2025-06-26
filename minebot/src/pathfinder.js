/** *************************************************************************************
   
    * @file        pathfinder.js
    * @brief       Pathfinding algorithms and navigation logic for bot movement
    * @author      Agustín I. Galdeman
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-25
    * @version     1.0 - Initial pathfinding module

    ************************************************************************************* */


/* **************************************************************************************
    * CONSTANTS AND STATIC DATA *
   ************************************************************************************** */

// Available movement directions
const DIRECTIONS = ['north', 'south', 'east', 'west'];

// Direction mappings for position calculation
const DIRECTION_OFFSETS = {
    north: { x: 0, z: -1 },
    south: { x: 0, z: 1 },
    west: { x: -1, z: 0 },
    east: { x: 1, z: 0 }
};

// Direction mappings for yaw rotation
const DIRECTION_YAW = {
    north: Math.PI,
    south: 0,
    west: Math.PI / 2,
    east: -Math.PI / 2
};


/* **************************************************************************************
    * CLASS IMPLEMENTATIONS *
   ************************************************************************************** */

/**
 * @class SimplePathfinder
 * @brief Basic pathfinding implementation with obstacle avoidance
 */
class SimplePathfinder
{
    /**
     * @brief Constructor initializes pathfinder with actions reference
     * @param {Object} actions - BotActions instance for world queries
     */
    constructor(actions)
    {
        this.actions = actions;
        this.currentDirection = 'west';
        
        // Obstacle detection flags
        this.feetBlocked = false;
        this.headBlocked = false;
        this.aboveBlocked = false;
        this.overheadBlocked = false;
    }

    /**
     * @brief Scans environment around bot for obstacles
     */
    scanEnvironment()
    {
        const pos = this.actions.position();
        const offset = DIRECTION_OFFSETS[this.currentDirection];
        const frontPos = { x: pos.x + offset.x, z: pos.z + offset.z };
        
        // Reset flags
        this.feetBlocked = false;
        this.headBlocked = false;
        this.aboveBlocked = false;
        this.overheadBlocked = false;
        
        let solidBlocks = 0;

        // Check feet level (same Y as bot) in front
        const feetBlock = this.actions.block_at(frontPos.x, pos.y, frontPos.z);
        if (feetBlock && feetBlock.name !== 'air')
        {
            this.feetBlocked = true;
            solidBlocks++;
        }

        // Check head level (Y + 1) in front
        const headBlock = this.actions.block_at(frontPos.x, pos.y + 1, frontPos.z);
        if (headBlock && headBlock.name !== 'air')
        {
            this.headBlocked = true;
            solidBlocks++;
        }

        // Check above head level (Y + 2) in front
        const aboveBlock = this.actions.block_at(frontPos.x, pos.y + 2, frontPos.z);
        if (aboveBlock && aboveBlock.name !== 'air')
        {
            this.aboveBlocked = true;
            solidBlocks++;
        }

        // Check directly overhead of bot (Y + 2, same X/Z)
        const overheadBlock = this.actions.block_at(pos.x, pos.y + 2, pos.z);
        if (overheadBlock && overheadBlock.name !== 'air')
        {
            this.overheadBlocked = true;
            solidBlocks++;
        }

        if (solidBlocks > 0)
        {
            console.log(`Environment scan: ${solidBlocks} solid blocks detected`);
        }
    }

    /**
     * @brief Determines next movement action based on current environment
     * @returns {Object} Movement decision with action type and parameters
     */
    getNextMovement()
    {
        this.scanEnvironment();

        // Change direction if: head blocked OR (feet blocked AND (overhead OR above))
        if (this.headBlocked || (this.feetBlocked && (this.overheadBlocked || this.aboveBlocked)))
        {
            return {
                action: 'change_direction',
                newDirection: this.getNextDirection()
            };
        }
        else if (this.feetBlocked && !this.headBlocked && !this.aboveBlocked)
        {
            // Jump if only feet blocked
            return {
                action: 'jump_and_move',
                direction: this.currentDirection
            };
        }
        else
        {
            // Normal movement
            return {
                action: 'move',
                direction: this.currentDirection
            };
        }
    }

    /**
     * @brief Calculates next direction in sequence
     * @returns {string} Next direction to try
     */
    getNextDirection()
    {
        const currentIndex = DIRECTIONS.indexOf(this.currentDirection);
        const nextIndex = (currentIndex + 1) % DIRECTIONS.length;
        return DIRECTIONS[nextIndex];
    }

    /**
     * @brief Sets current movement direction
     * @param {string} direction - New direction to set
     */
    setDirection(direction)
    {
        if (DIRECTIONS.includes(direction))
        {
            this.currentDirection = direction;
        }
    }

    /**
     * @brief Gets current movement direction
     * @returns {string} Current direction
     */
    getDirection()
    {
        return this.currentDirection;
    }

    /**
     * @brief Gets yaw angle for given direction
     * @param {string} direction - Direction to get yaw for
     * @returns {number} Yaw angle in radians
     */
    getDirectionYaw(direction)
    {
        return DIRECTION_YAW[direction] || 0;
    }
}

module.exports = SimplePathfinder;