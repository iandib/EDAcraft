/** *************************************************************************************
   
    * @file        pathfinder.js
    * @brief       Pathfinding algorithms and navigation logic for bot movement
    * @author      Agustín I. Galdeman
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-25
    * @version     2.0 - Added goal-based pathfinding

    ************************************************************************************* */


/* **************************************************************************************
    * CONSTANTS AND STATIC DATA *
   ************************************************************************************** */

// Available movement directions
const DIRECTIONS = ['north', 'south', 'east', 'west'];

// Direction mappings for front position calculation
const DIRECTION_OFFSETS = 
{
    north: { x: 0, z: -1 },
    south: { x: 0, z: 1 },
    west: { x: -1, z: 0 },
    east: { x: 1, z: 0 }
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
        this.currentDirection = 'east';
        
        // Obstacle detection flags
        this.feetBlocked = false;
        this.headBlocked = false;
        this.aboveBlocked = false;
        this.overheadBlocked = false;
                
        // Goal-based navigation
        this.goalPosition = null;
        this.movementPlan = null;
        this.isGoalMode = false;
        this.isIdle = false;
    }

    /**
     * @brief Sets goal coordinates and calculates movement plan
     * @param {number} x - Target X coordinate
     * @param {number} y - Target Y coordinate (ignored for horizontal movement)
     * @param {number} z - Target Z coordinate
     */
    setGoal(x, y, z)
    {
        this.goalPosition = { x, y, z };
        this.calculateMovementPlan();
        this.isGoalMode = true;
        this.isIdle = false;
        console.log(`Goal set to: x:${x}, y:${y}, z:${z}`);
    }

    /**
     * @brief Calculates movement plan to reach goal position
     */
    calculateMovementPlan()
    {
        if (!this.goalPosition) return;
        
        const currentPos = this.actions.position();
        const deltaX = this.goalPosition.x - currentPos.x;
        const deltaZ = this.goalPosition.z - currentPos.z;
        
        this.movementPlan = {
            north: deltaZ < 0 ? Math.abs(deltaZ) : 0,
            south: deltaZ > 0 ? deltaZ : 0,
            west: deltaX < 0 ? Math.abs(deltaX) : 0,
            east: deltaX > 0 ? deltaX : 0,
            completed: {
                north: 0,
                south: 0,
                west: 0,
                east: 0
            }
        };
        
        console.log(`Movement plan calculated:`);
        console.log(`  North: ${this.movementPlan.north} steps`);
        console.log(`  South: ${this.movementPlan.south} steps`);
        console.log(`  West: ${this.movementPlan.west} steps`);
        console.log(`  East: ${this.movementPlan.east} steps`);
    }

    /**
     * @brief Gets the next direction needed to reach the goal
     * @returns {string|null} Next direction to move, or null if goal reached
     */
    getNextGoalDirection()
    {
        if (!this.movementPlan) return null;
        
        for (const direction of DIRECTIONS)
        {
            const needed = this.movementPlan[direction];
            const completed = this.movementPlan.completed[direction];
            
            if (completed < needed)
            {
                return direction;
            }
        }
        
        return null; // Goal reached
    }

    /**
     * @brief Marks a step as completed in the movement plan
     * @param {string} direction - Direction that was completed
     */
    completeStep(direction)
    {
        if (this.movementPlan && this.movementPlan.completed[direction] < this.movementPlan[direction])
        {
            this.movementPlan.completed[direction]++;
            console.log(`Completed step ${direction}: ${this.movementPlan.completed[direction]}/${this.movementPlan[direction]}`);
        }
    }

    /**
     * @brief Checks if goal has been reached
     * @returns {boolean} True if goal reached, false otherwise
     */
    isGoalReached()
    {
        if (!this.movementPlan) return false;
        
        for (const direction of DIRECTIONS)
        {
            if (this.movementPlan.completed[direction] < this.movementPlan[direction])
            {
                return false;
            }
        }
        
        console.log('Goal reached!');
        this.isGoalMode = false;
        this.goalPosition = null;
        this.movementPlan = null;
        return true;
    }

    /**
     * @brief Sets bot to idle state
     */
    setIdle()
    {
        this.isIdle = true;
        console.log('Bot set to idle due to impassable obstacle');
    }

    /**
     * @brief Clears idle state
     */
    clearIdle()
    {
        this.isIdle = false;
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

        // Check feet level (same Y as bot) in front
        const feetBlock = this.actions.block_at(frontPos.x, pos.y, frontPos.z);
        if (feetBlock && feetBlock.name !== 'air')
        {
            this.feetBlocked = true;
            console.log('feet');
        }

        // Check head level (Y + 1) in front
        const headBlock = this.actions.block_at(frontPos.x, pos.y + 1, frontPos.z);
        if (headBlock && headBlock.name !== 'air')
        {
            this.headBlocked = true;
            console.log('head');
        }

        // Check above head level (Y + 2) in front
        const aboveBlock = this.actions.block_at(frontPos.x, pos.y + 2, frontPos.z);
        if (aboveBlock && aboveBlock.name !== 'air')
        {
            this.aboveBlocked = true;
            console.log('above');
        }

        // Check directly overhead of bot (Y + 2, same X/Z)
        const overheadBlock = this.actions.block_at(pos.x, pos.y + 2, pos.z);
        if (overheadBlock && overheadBlock.name !== 'air')
        {
            this.overheadBlocked = true;
            console.log('over');
        }
    }

    /**
     * @brief Determines next movement action based on current environment
     * @returns {Object} Movement decision with action type and parameters
     */
    getNextMovement()
    {
        // If idle, don't move
        if (this.isIdle)
        {
            return { action: 'idle' };
        }

        // Goal-based movement
        if (this.isGoalMode)
        {
            if (this.isGoalReached())
            {
                return { action: 'idle' };
            }

            const nextDirection = this.getNextGoalDirection();
            if (!nextDirection)
            {
                return { action: 'idle' };
            }

            this.currentDirection = nextDirection;
        }

        this.scanEnvironment();

        // Obstacle type A: Only feet blocked (can jump)
        if (this.feetBlocked && !this.headBlocked && !this.aboveBlocked && !this.overheadBlocked)
        {
            return {
                action: 'jump_and_move',
                direction: this.currentDirection
            };
        }
        // Obstacle type B: Head blocked OR (feet blocked AND (overhead OR above)) - impassable
        else if (this.headBlocked || (this.feetBlocked && (this.overheadBlocked || this.aboveBlocked)))
        {
            console.error(`Impassable obstacle detected at direction ${this.currentDirection}`);
            this.setIdle();
            return { action: 'idle' };
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
     * @brief Calculates next direction in sequence (for non-goal movement)
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
}

module.exports = SimplePathfinder;