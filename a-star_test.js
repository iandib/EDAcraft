/** *************************************************************************************
   
    * @file        pathfinder.js
    * @brief       A* pathfinding algorithms and navigation logic for bot movement
    * @author      Agustín I. Galdeman
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-25
    * @version     2.0 - A* pathfinding implementation

    ************************************************************************************* */


/* **************************************************************************************
    * CONSTANTS AND STATIC DATA *
   ************************************************************************************** */

// Available movement directions
const DIRECTIONS = ['north', 'south', 'east', 'west'];

// Direction mappings for position calculation
const DIRECTION_OFFSETS =
{
    north: { x: 0, z: -1 },
    south: { x: 0, z: 1 },
    west: { x: -1, z: 0 },
    east: { x: 1, z: 0 }
};

// Direction mappings for yaw rotation
const DIRECTION_YAW =
{
    north: Math.PI,
    south: 0,
    west: Math.PI / 2,
    east: -Math.PI / 2
};

// Target coordinates
const TARGET_POSITION = { x: -791, y: 103, z: 152 };

// Block movement costs
const BLOCK_COSTS = {
    'air': 1,
    'water': 10,
    'lava': 100,
    'flowing_water': 10,
    'flowing_lava': 100
};

// Grid size for pathfinding
const GRID_SIZE = 64;
const GRID_CENTER = Math.floor(GRID_SIZE / 2);


/* **************************************************************************************
    * A* ALGORITHM IMPLEMENTATION *
   ************************************************************************************** */

/**
 * @class AStarNode
 * @brief Node class for A* pathfinding
 */
class AStarNode
{
    constructor(x, z, g = 0, h = 0, parent = null)
    {
        this.x = x;
        this.z = z;
        this.g = g; // Cost from start
        this.h = h; // Heuristic to goal
        this.f = g + h; // Total cost
        this.parent = parent;
    }

    equals(other)
    {
        return this.x === other.x && this.z === other.z;
    }

    toString()
    {
        return `${this.x},${this.z}`;
    }
}

/**
 * @brief Manhattan distance heuristic
 * @param {number} x1 - Start X coordinate
 * @param {number} z1 - Start Z coordinate
 * @param {number} x2 - End X coordinate
 * @param {number} z2 - End Z coordinate
 * @returns {number} Manhattan distance
 */
function manhattanDistance(x1, z1, x2, z2)
{
    return Math.abs(x1 - x2) + Math.abs(z1 - z2);
}

/**
 * @brief A* pathfinding algorithm
 * @param {Object} grid - 2D grid with movement costs
 * @param {Object} start - Start position {x, z}
 * @param {Object} goal - Goal position {x, z}
 * @returns {Array} Path as array of positions
 */
function aStarAlgorithm(grid, start, goal)
{
    const openSet = [];
    const closedSet = new Set();
    
    const startNode = new AStarNode(start.x, start.z, 0, manhattanDistance(start.x, start.z, goal.x, goal.z));
    openSet.push(startNode);
    
    while (openSet.length > 0)
    {
        // Find node with lowest f cost
        let currentNode = openSet[0];
        let currentIndex = 0;
        
        for (let i = 1; i < openSet.length; i++)
        {
            if (openSet[i].f < currentNode.f)
            {
                currentNode = openSet[i];
                currentIndex = i;
            }
        }
        
        // Remove current from open set and add to closed set
        openSet.splice(currentIndex, 1);
        closedSet.add(currentNode.toString());
        
        // Check if we reached the goal
        if (currentNode.x === goal.x && currentNode.z === goal.z)
        {
            const path = [];
            let node = currentNode;
            while (node !== null)
            {
                path.unshift({ x: node.x, z: node.z });
                node = node.parent;
            }
            return path;
        }
        
        // Check neighbors
        const neighbors = [
            { x: currentNode.x + 1, z: currentNode.z },
            { x: currentNode.x - 1, z: currentNode.z },
            { x: currentNode.x, z: currentNode.z + 1 },
            { x: currentNode.x, z: currentNode.z - 1 }
        ];
        
        for (const neighbor of neighbors)
        {
            const neighborKey = `${neighbor.x},${neighbor.z}`;
            
            // Skip if in closed set
            if (closedSet.has(neighborKey)) continue;
            
            // Get movement cost for this position
            const movementCost = grid[neighbor.x] && grid[neighbor.x][neighbor.z] !== undefined 
                ? grid[neighbor.x][neighbor.z] 
                : 1;
            
            // Skip if impassable
            if (movementCost >= 1000) continue;
            
            const tentativeG = currentNode.g + movementCost;
            
            // Check if this neighbor is already in open set
            let existingNode = openSet.find(node => node.x === neighbor.x && node.z === neighbor.z);
            
            if (!existingNode)
            {
                // New node
                const h = manhattanDistance(neighbor.x, neighbor.z, goal.x, goal.z);
                const newNode = new AStarNode(neighbor.x, neighbor.z, tentativeG, h, currentNode);
                openSet.push(newNode);
            }
            else if (tentativeG < existingNode.g)
            {
                // Better path to existing node
                existingNode.g = tentativeG;
                existingNode.f = existingNode.g + existingNode.h;
                existingNode.parent = currentNode;
            }
        }
    }
    
    return []; // No path found
}


/* **************************************************************************************
    * CLASS IMPLEMENTATIONS *
   ************************************************************************************** */

/**
 * @class SimplePathfinder
 * @brief A* pathfinding implementation with obstacle avoidance
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
        this.path = [];
        this.currentPathIndex = 0;
        this.lastPosition = null;
        this.grid = {};
        this.pathRecalculationNeeded = true;
        
        // Obstacle detection flags
        this.feetBlocked = false;
        this.headBlocked = false;
        this.aboveBlocked = false;
        this.overheadBlocked = false;
    }

    /**
     * @brief Gets movement cost for a block type
     * @param {string} blockName - Name of the block
     * @returns {number} Movement cost
     */
    getBlockCost(blockName)
    {
        return BLOCK_COSTS[blockName] || 1;
    }

    /**
     * @brief Updates the movement cost grid around the bot
     */
    updateGrid()
    {
        const pos = this.actions.position();
        const halfGrid = Math.floor(GRID_SIZE / 2);
        
        // Clear previous grid
        this.grid = {};
        
        // Scan area around bot
        for (let x = pos.x - halfGrid; x <= pos.x + halfGrid; x++)
        {
            this.grid[x] = {};
            for (let z = pos.z - halfGrid; z <= pos.z + halfGrid; z++)
            {
                const block = this.actions.block_at(x, pos.y, z);
                const blockName = block ? block.name : 'air';
                this.grid[x][z] = this.getBlockCost(blockName);
            }
        }
    }

    /**
     * @brief Marks a position as impassable in the grid
     * @param {number} x - X coordinate
     * @param {number} z - Z coordinate
     */
    markAsImpassable(x, z)
    {
        if (this.grid[x])
        {
            this.grid[x][z] = 1000; // High cost = impassable
        }
    }

    /**
     * @brief Calculates A* path to target
     */
    calculatePath()
    {
        const pos = this.actions.position();
        this.updateGrid();
        
        const start = { x: pos.x, z: pos.z };
        const goal = { x: TARGET_POSITION.x, z: TARGET_POSITION.z };
        
        this.path = aStarAlgorithm(this.grid, start, goal);
        this.currentPathIndex = 0;
        this.pathRecalculationNeeded = false;
        
        if (this.path.length === 0)
        {
            console.log("No path found to target");
        }
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
        }

        // Check head level (Y + 1) in front
        const headBlock = this.actions.block_at(frontPos.x, pos.y + 1, frontPos.z);
        if (headBlock && headBlock.name !== 'air')
        {
            this.headBlocked = true;
        }

        // Check above head level (Y + 2) in front
        const aboveBlock = this.actions.block_at(frontPos.x, pos.y + 2, frontPos.z);
        if (aboveBlock && aboveBlock.name !== 'air')
        {
            this.aboveBlocked = true;
        }

        // Check directly overhead of bot (Y + 2, same X/Z)
        const overheadBlock = this.actions.block_at(pos.x, pos.y + 2, pos.z);
        if (overheadBlock && overheadBlock.name !== 'air')
        {
            this.overheadBlocked = true;
        }
    }

    /**
     * @brief Gets the direction to move towards the next waypoint
     * @returns {string} Direction to move
     */
    getDirectionToNextWaypoint()
    {
        if (this.path.length === 0 || this.currentPathIndex >= this.path.length)
        {
            return this.currentDirection;
        }
        
        const pos = this.actions.position();
        const nextWaypoint = this.path[this.currentPathIndex];
        
        const dx = nextWaypoint.x - pos.x;
        const dz = nextWaypoint.z - pos.z;
        
        // Determine direction based on largest offset
        if (Math.abs(dx) > Math.abs(dz))
        {
            return dx > 0 ? 'east' : 'west';
        }
        else
        {
            return dz > 0 ? 'south' : 'north';
        }
    }

    /**
     * @brief Checks if bot has reached the current waypoint
     */
    updateWaypointProgress()
    {
        if (this.path.length === 0 || this.currentPathIndex >= this.path.length)
        {
            return;
        }
        
        const pos = this.actions.position();
        const currentWaypoint = this.path[this.currentPathIndex];
        
        // Check if we've reached the current waypoint
        if (pos.x === currentWaypoint.x && pos.z === currentWaypoint.z)
        {
            this.currentPathIndex++;
        }
    }

    /**
     * @brief Determines next movement action based on current environment and A* path
     * @returns {Object} Movement decision with action type and parameters
     */
    getNextMovement()
    {
        const pos = this.actions.position();
        
        // Check if we need to recalculate path
        if (this.pathRecalculationNeeded || this.path.length === 0 || 
            !this.lastPosition || pos.x !== this.lastPosition.x || pos.z !== this.lastPosition.z)
        {
            this.calculatePath();
            this.lastPosition = { x: pos.x, z: pos.z };
        }
        
        // Update waypoint progress
        this.updateWaypointProgress();
        
        // Get direction towards next waypoint
        const targetDirection = this.getDirectionToNextWaypoint();
        this.currentDirection = targetDirection;
        
        // Scan environment for obstacles
        this.scanEnvironment();

        // Handle obstacles - change direction if: head blocked OR (feet blocked AND (overhead OR above))
        if (this.headBlocked || (this.feetBlocked && (this.overheadBlocked || this.aboveBlocked)))
        {
            console.log("Obstacle detected - recalculating path");
            
            // Mark current front position as impassable
            const offset = DIRECTION_OFFSETS[this.currentDirection];
            const frontPos = { x: pos.x + offset.x, z: pos.z + offset.z };
            this.markAsImpassable(frontPos.x, frontPos.z);
            
            // Recalculate path immediately
            this.calculatePath();
            
            // Get new direction from recalculated path
            const newDirection = this.getDirectionToNextWaypoint();
            
            return {
                action: 'change_direction',
                newDirection: newDirection
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

    /**
     * @brief Checks if bot has reached the target
     * @returns {boolean} True if at target position
     */
    isAtTarget()
    {
        const pos = this.actions.position();
        return pos.x === TARGET_POSITION.x && pos.z === TARGET_POSITION.z;
    }
}

module.exports = SimplePathfinder;