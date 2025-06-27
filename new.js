/** *************************************************************************************
   
    * @file        pathfinder.js
    * @brief       A* pathfinding algorithm with 3D environment scanning for bot navigation
    * @author      Agustín I. Galdeman
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-27
    * @version     3.2 - Refactored and consolidated obstacle detection logic

    ************************************************************************************* */


/* **************************************************************************************
    * CONSTANTS AND STATIC DATA *
   ************************************************************************************** */

// Available movement directions
const DIRECTIONS = ['north', 'south', 'east', 'west'];

// Direction mappings for movement calculation
const DIRECTION_OFFSETS = 
{
    north: {x: 0, z: -1},
    south: {x: 0, z: 1},
    west: {x: -1, z: 0},
    east: {x: 1, z: 0}
};

// Block traversal costs for pathfinding weights
const BLOCK_COSTS = 
{
    air: 1,           // Standard movement cost
    water: 10,        // High cost for water traversal
    lava: Infinity,   // Impassable - infinite cost
    // All other solid blocks default to 1 unless marked as impassable
};

// Grid scanning dimensions (3x3x3 around bot)
const SCAN_RADIUS = 1;
const SCAN_HEIGHT = 3;


/* **************************************************************************************
    * UTILITY CLASSES FOR A* IMPLEMENTATION *
   ************************************************************************************** */

/**
 * @class PathNode
 * @brief Represents a node in the A* pathfinding grid
 */
class PathNode 
{
    constructor(x, z, gCost = 0, hCost = 0, parent = null) 
    {
        this.x = x;
        this.z = z;
        this.gCost = gCost;      // Distance from start node
        this.hCost = hCost;      // Heuristic distance to goal
        this.fCost = gCost + hCost; // Total cost
        this.parent = parent;    // Parent node for path reconstruction
    }

    // Update costs and recalculate fCost
    updateCosts(gCost, hCost) 
    {
        this.gCost = gCost;
        this.hCost = hCost;
        this.fCost = gCost + hCost;
    }
}


/* **************************************************************************************
    * MAIN PATHFINDER CLASS *
   ************************************************************************************** */

/**
 * @class SimplePathfinder
 * @brief A* pathfinding implementation with 3D environment scanning and obstacle detection
 */
class SimplePathfinder
{
    /**
     * @brief Constructor initializes pathfinder with actions reference and A* structures
     * @param {Object} actions - BotActions instance for world queries
     */
    constructor(actions)
    {
        this.actions = actions;
        this.currentDirection = 'east';
        
        // Bot starting position - initialized when goal is set
        this.startPosition = null;
        
        // 2D grid for pathfinding (x,z coordinates with traversal costs)
        this.grid = new Map(); // Key: "x,z", Value: cost
        
        // Goal-based navigation with A* path
        this.goalPosition = null;
        this.currentPath = [];        // Array of {x, z} coordinates
        this.currentPathIndex = 0;    // Current step in the path
        this.isGoalMode = false;
        this.isIdle = false;
        
        console.log('[PF] Pathfinder initialized');
    }

    /**
     * @brief Sets goal coordinates, records start position, and calculates A* path
     * @param {number} x - Target X coordinate
     * @param {number} y - Target Y coordinate (used for goal but pathfinding is 2D)
     * @param {number} z - Target Z coordinate
     */
    setGoal(x, y, z)
    {
        console.log(`[PF] Setting goal to x:${x}, y:${y}, z:${z}`);
        
        // Record the bot's starting position when goal is set
        this.startPosition = this.actions.position();
        console.log(`[PF] Bot start: x:${this.startPosition.x}, y:${this.startPosition.y}, z:${this.startPosition.z}`);
        
        this.goalPosition = {x, y, z};
        this.isGoalMode = true;
        this.isIdle = false;
        this.currentPathIndex = 0;
        
        // Build pathfinding grid and calculate A* path
        this.buildPathfindingGrid();
        this.calculateAStarPath();
    }

    /**
     * @brief Unified obstacle detection for a specific coordinate
     * @param {number} x - X coordinate to check
     * @param {number} y - Y coordinate (bot's feet level)
     * @param {number} z - Z coordinate to check
     * @returns {Object} Obstacle information with traversalCost, canJump, isBlocked flags
     */
    analyzePosition(x, y, z)
    {
        // Get block information at different heights
        const feetBlock = this.actions.block_at(x, y, z);
        const headBlock = this.actions.block_at(x, y + 1, z);
        const aboveBlock = this.actions.block_at(x, y + 2, z);
        
        const feetBlocked = feetBlock && feetBlock.name !== 'air';
        const headBlocked = headBlock && headBlock.name !== 'air';
        const aboveBlocked = aboveBlock && aboveBlock.name !== 'air';
        
        // Determine traversal properties
        let traversalCost = 1;
        let canJump = false;
        let isBlocked = false;
        
        // Impassable conditions
        if (headBlocked || (feetBlocked && aboveBlocked)) 
        {
            traversalCost = Infinity;
            isBlocked = true;
        }
        // Only feet blocked (can jump over)
        else if (feetBlocked && !headBlocked && !aboveBlocked) 
        {
            canJump = true;
            traversalCost = BLOCK_COSTS[feetBlock.name] || 1;
        }
        // Clear path - check for special block costs
        else if (feetBlock) 
        {
            traversalCost = BLOCK_COSTS[feetBlock.name] || 1;
        }
        
        return { traversalCost, canJump, isBlocked };
    }

    /**
     * @brief Builds 2D pathfinding grid with traversal costs based on environment analysis
     */
    buildPathfindingGrid()
    {
        if (!this.startPosition || !this.goalPosition) 
        {
            console.log('[PF] ERROR: Start or goal position missing');
            return;
        }
        
        //? Es correcto limpiar la grid?
        this.grid.clear();
        
        // Determine grid bounds (from start to goal plus padding)
        const minX = Math.min(this.startPosition.x, this.goalPosition.x) - 5;
        const maxX = Math.max(this.startPosition.x, this.goalPosition.x) + 5;
        const minZ = Math.min(this.startPosition.z, this.goalPosition.z) - 5;
        const maxZ = Math.max(this.startPosition.z, this.goalPosition.z) + 5;
        
        let gridCells = 0;
        // Build grid with costs using unified position analysis
        for (let x = minX; x <= maxX; x++) 
        {
            for (let z = minZ; z <= maxZ; z++) 
            {
                const analysis = this.analyzePosition(x, this.startPosition.y, z);
                this.grid.set(`${x},${z}`, analysis.traversalCost);
                gridCells++;
            }
        }
        
        console.log(`[PF] Grid built: ${maxX - minX + 1}x${maxZ - minZ + 1} = ${gridCells} cells`);
    }

    /**
     * @brief Calculates Manhattan distance heuristic for A* algorithm
     * @param {number} x1 - Start X coordinate
     * @param {number} z1 - Start Z coordinate  
     * @param {number} x2 - End X coordinate
     * @param {number} z2 - End Z coordinate
     * @returns {number} Manhattan distance
     */
    manhattanDistance(x1, z1, x2, z2)
    {
        return Math.abs(x1 - x2) + Math.abs(z1 - z2);
    }

    /**
     * @brief Implements A* pathfinding algorithm to find optimal path
     * @returns {Array} Array of {x, z} coordinates representing the path
     */
    calculateAStarPath()
    {
        if (!this.startPosition || !this.goalPosition) 
        {
            console.log('[PF] ERROR: Start or goal position not set');
            return [];
        }
        
        const startNode = new PathNode(
            this.startPosition.x, 
            this.startPosition.z, 
            0, 
            this.manhattanDistance(this.startPosition.x, this.startPosition.z, this.goalPosition.x, this.goalPosition.z)
        );
        
        const openSet = [startNode];  // Nodes to be evaluated
        const closedSet = new Set();  // Nodes already evaluated (using "x,z" strings)
        const allNodes = new Map();   // All created nodes for quick lookup
        
        allNodes.set(`${startNode.x},${startNode.z}`, startNode);
        
        let iterations = 0;
        while (openSet.length > 0) 
        {
            iterations++;
            // Prevent infinite loops
            if (iterations > 10000) 
            {
                console.log('[PF] ERROR: A* exceeded max iterations, aborting');
                this.setIdle();
                return [];
            }
            
            // Find node with lowest fCost
            let currentNode = openSet[0];
            let currentIndex = 0;
            
            for (let i = 1; i < openSet.length; i++) 
            {
                if (openSet[i].fCost < currentNode.fCost) 
                {
                    currentNode = openSet[i];
                    currentIndex = i;
                }
            }
            
            // Remove current node from open set and add to closed set
            openSet.splice(currentIndex, 1);
            closedSet.add(`${currentNode.x},${currentNode.z}`);
            
            // Check if we reached the goal
            if (currentNode.x === this.goalPosition.x && currentNode.z === this.goalPosition.z) 
            {
                console.log(`[PF] A* path found`);
                this.currentPath = this.reconstructPath(currentNode);
                return this.currentPath;
            }
            
            // Check all neighboring positions (4-directional movement)
            for (const direction of DIRECTIONS) 
            {
                const offset = DIRECTION_OFFSETS[direction];
                const neighborX = currentNode.x + offset.x;
                const neighborZ = currentNode.z + offset.z;
                const neighborKey = `${neighborX},${neighborZ}`;
                
                // Skip if already evaluated
                if (closedSet.has(neighborKey)) continue;
                
                // Get movement cost for this position
                const movementCost = this.grid.get(neighborKey) || Infinity;
                if (movementCost === Infinity) continue; // Skip impassable terrain
                
                const tentativeGCost = currentNode.gCost + movementCost;
                
                // Check if we have this neighbor in our nodes
                let neighborNode = allNodes.get(neighborKey);
                
                if (!neighborNode) 
                {
                    // Create new neighbor node
                    const hCost = this.manhattanDistance(neighborX, neighborZ, this.goalPosition.x, this.goalPosition.z);
                    neighborNode = new PathNode(neighborX, neighborZ, tentativeGCost, hCost, currentNode);
                    allNodes.set(neighborKey, neighborNode);
                    openSet.push(neighborNode);
                } 
                else if (tentativeGCost < neighborNode.gCost) 
                {
                    // Better path to this neighbor found
                    const hCost = this.manhattanDistance(neighborX, neighborZ, this.goalPosition.x, this.goalPosition.z);
                    neighborNode.updateCosts(tentativeGCost, hCost);
                    neighborNode.parent = currentNode;
                    
                    // Add to open set if not already there
                    if (!openSet.includes(neighborNode)) 
                    {
                        openSet.push(neighborNode);
                    }
                }
            }
        }
        
        console.log('[PF] ERROR: A* failed - no path found');
        this.setIdle();
        return [];
    }

    /**
     * @brief Reconstructs path from goal node back to start using parent links
     * @param {PathNode} goalNode - The goal node reached by A*
     * @returns {Array} Array of {x, z} coordinates from start to goal
     */
    reconstructPath(goalNode)
    {
        const path = [];
        let currentNode = goalNode;
        
        while (currentNode !== null) 
        {
            path.unshift({x: currentNode.x, z: currentNode.z});
            currentNode = currentNode.parent;
        }
        
        console.log(`[PF] Path reconstructed: ${path.length} steps`);
        return path;
    }

    /**
     * @brief Gets next movement action based on A* path and immediate obstacles
     * @returns {Object} Movement decision with action type and parameters
     */
    getNextMovement()
    {
        const currentPos = this.actions.position();
        console.log(`[PF] Bot position: x:${currentPos.x}, y:${currentPos.y}, z:${currentPos.z}`);

        // If idle, don't move
        if (this.isIdle) 
        {
            return { action: 'idle' };
        }

        // Goal-based A* movement
        if (this.isGoalMode) 
        {
            //! Marca que llegó al goal erróneamente
            if (this.currentPathIndex >= this.currentPath.length)
            {
                console.log('[PF] Goal reached!');
                this.isGoalMode = false;
                return { action: 'idle' };
            }

            const nextStep = this.currentPath[this.currentPathIndex];
            
            // Determine direction to next step
            const deltaX = nextStep.x - currentPos.x;
            const deltaZ = nextStep.z - currentPos.z;
            
            let targetDirection = null;
            if (deltaX > 0) targetDirection = 'east';
            else if (deltaX < 0) targetDirection = 'west';
            else if (deltaZ > 0) targetDirection = 'south';
            else if (deltaZ < 0) targetDirection = 'north';
            
            if (!targetDirection) 
            {
                // Already at target step, move to next
                this.currentPathIndex++;
                return this.getNextMovement();
            }
            
            this.currentDirection = targetDirection;
            
            // Check immediate obstacles using unified analysis
            const offset = DIRECTION_OFFSETS[this.currentDirection];
            const frontPos = { 
                x: currentPos.x + offset.x, 
                z: currentPos.z + offset.z 
            };
            
            // Also check overhead block for jumping
            const overheadBlock = this.actions.block_at(currentPos.x, currentPos.y + 2, currentPos.z);
            const overheadBlocked = overheadBlock && overheadBlock.name !== 'air';
            
            const frontAnalysis = this.analyzePosition(frontPos.x, currentPos.y, frontPos.z);
            
            if (frontAnalysis.canJump && !overheadBlocked) 
            {
                return {
                    action: 'jump_and_move',
                    direction: this.currentDirection
                };
            } 
            else if (frontAnalysis.isBlocked) 
            {
                console.log('[PF] Path blocked');
                // Rebuild grid and recalculate path
                this.buildPathfindingGrid();
                this.calculateAStarPath();
                this.currentPathIndex = 0;
                return { action: 'idle' }; // Wait for next cycle
            } 
            else 
            {
                return {
                    action: 'move',
                    direction: this.currentDirection
                };
            }
        }

        return { action: 'idle' };
    }

    /**
     * @brief Marks a step as completed in the A* path
     * @param {string} direction - Direction that was completed (for compatibility)
     */
    completeStep(direction)
    {
        if (this.isGoalMode && this.currentPathIndex < this.currentPath.length) 
        {
            this.currentPathIndex++;
            const remaining = this.currentPath.length - this.currentPathIndex;
        }
    }

    /**
     * @brief Sets bot to idle state
     */
    setIdle()
    {
        this.isIdle = true;
        console.log('[PF] Bot set to idle');
    }

    /**
     * @brief Clears idle state
     */
    clearIdle()
    {
        this.isIdle = false;
        console.log('[PF] Bot cleared from idle');
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