/** *************************************************************************************
   
    * @file        pathfinder.js
    * @brief       A* pathfinding algorithm with 3D environment scanning for bot navigation
    * @author      Agustín I. Galdeman
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-27
    * @version     4.0 - Deleted unused methods and flags

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
// All other solid blocks default to 1 unless marked as impassable
const BLOCK_COSTS = 
{
    air: 1,           // Standard movement cost
    water: Infinity,  // Impassable - infinite cost
    lava: Infinity,   // Impassable - infinite cost
};

// Grid scanning dimensions (3x3x3 around bot)
const SCAN_RADIUS = 1;
const SCAN_HEIGHT = 3;

// Rescan environment every N steps
const RESCAN_INTERVAL = 3;


/* **************************************************************************************
    * UTILITY CLASS FOR A* IMPLEMENTATION *
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
        this.gCost = gCost;          // Distance from start node
        this.hCost = hCost;          // Heuristic distance to goal
        this.fCost = gCost + hCost;  // Total cost
        this.parent = parent;        // Parent node for path reconstruction
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
        
        // 2D grid for pathfinding (Key: "x,z", Value: cost)
        this.grid = new Map();
        
        // Set of impassable coordinates and coordinates where bot needs to jump
        this.impassableCoords = new Set();
        this.jumpCoords = new Set();
        
        // Goal-based navigation with A* path
        this.goalPosition = null;
        this.currentPath = []; 
        this.currentPathIndex = 0;
        
        // Environment scanning results (Key: "x,y,z", Value: block info)
        this.environmentData = new Map();
        this.isFirstScan = true;
        
        // Step counter for periodic rescanning
        this.stepCount = 0;
        this.lastRescanStep = 0;

        // Stuck detection system
        this.positionHistory = [];
        this.maxHistorySize = 5;
        
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
        this.currentPathIndex = 0;
        this.stepCount = 0;
        
        // Perform initial environment scan and build grid for given goal 
        this.isFirstScan = true;
        this.performEnvironmentScan();
        
        // Calculate A* path from start to goal
        this.calculateAStarPath();
        
        console.log(`[PF] Goal set complete. Path has ${this.currentPath.length} steps`);
    }

    //* ENVIRONMENT OPERATIONS

    /**
     * @brief Performs full environment scan and builds grid
     */
    performEnvironmentScan()
    {
        if (this.isFirstScan) 
        {
            console.log('[PF] Initial environment scan starting');
            this.isFirstScan = false;

            // Clear data only on first scan
            this.impassableCoords.clear();
            this.jumpCoords.clear();
            this.grid.clear();
            this.environmentData.clear();

            // Scan current environment
            this.scanEnvironment();
            this.reactToEnvironment();
            
            // Build pathinding grid
            this.buildPathfindingGrid();
        }

        else 
        {
            console.log('[PF] Incremental environment scan starting');

            // Scan current environment
            this.scanEnvironment();
            this.reactToEnvironment();

            // Update pathfinding grid
            this.updatePathfindingGrid();
        }
    }

    /**
     * @brief Performs comprehensive 3x3x3 environment scanning around bot
     */
    scanEnvironment()
    {
        const botPos = this.actions.position();
        let blockCount = 0;

        // Scan 3x3x3 area around bot (from bot's feet level to 2 blocks above)
        for (let dx = -SCAN_RADIUS; dx <= SCAN_RADIUS; dx++) 
        {
            for (let dz = -SCAN_RADIUS; dz <= SCAN_RADIUS; dz++) 
            {
                for (let dy = 0; dy < SCAN_HEIGHT; dy++) 
                {
                    const scanX = botPos.x + dx;
                    const scanY = botPos.y + dy;
                    const scanZ = botPos.z + dz;
                    
                    const block = this.actions.block_at(scanX, scanY, scanZ);
                    const key = `${scanX},${scanY},${scanZ}`;
                    
                    // Update environment data (overwrites previous data for this position)
                    this.environmentData.set(key, 
                    {
                        name: block ? block.name : 'air',
                        position: {x: scanX, y: scanY, z: scanZ},
                        isEmpty: !block || block.name === 'air' || block.name === 'short grass'
                    });
                    
                    blockCount++;
                }
            }
        }

        console.log(`[PF] Scanned ${blockCount} blocks in environment`);
    }

    /**
     * @brief Analyzes scanned environment and updates impassable coordinates
     */
    reactToEnvironment()
    {
        const botPos = this.actions.position();
        let newImpassableCount = 0;
        let newJumpCount = 0;
        
        // Check each position in the scanned area
        for (let dx = -SCAN_RADIUS; dx <= SCAN_RADIUS; dx++) 
        {
            for (let dz = -SCAN_RADIUS; dz <= SCAN_RADIUS; dz++) 
            {
                const checkX = botPos.x + dx;
                const checkZ = botPos.z + dz;
                const coordKey = `${checkX},${checkZ}`;
                
                // Get block information at different heights
                const feetBlock = this.environmentData.get(`${checkX},${botPos.y},${checkZ}`);
                const headBlock = this.environmentData.get(`${checkX},${botPos.y + 1},${checkZ}`);
                const aboveBlock = this.environmentData.get(`${checkX},${botPos.y + 2},${checkZ}`);
                
                // Check for impassable conditions
                const hasHeadBlock = headBlock && !headBlock.isEmpty;
                const hasFeetBlock = feetBlock && !feetBlock.isEmpty;
                const hasAboveBlock = aboveBlock && !aboveBlock.isEmpty;
                
                // Remove from both sets first
                const wasImpassable = this.impassableCoords.has(coordKey);
                const wasJump = this.jumpCoords.has(coordKey);
                this.impassableCoords.delete(coordKey);
                this.jumpCoords.delete(coordKey);
                
                // Impassable: head blocked OR (feet blocked AND above blocked)
                if (hasHeadBlock || (hasFeetBlock && hasAboveBlock)) 
                {
                    if (!wasImpassable) newImpassableCount++;
                    this.impassableCoords.add(coordKey);
                }

                // Jump required: only feet blocked, head and above clear
                else if (hasFeetBlock && !hasHeadBlock && !hasAboveBlock)
                {
                    if (!wasJump) newJumpCount++;
                    this.jumpCoords.add(coordKey);
                }
            }
        }
        
        if (newImpassableCount > 0)
        {
            console.log(`[PF] Found ${newImpassableCount} new impassable coordinates`);
        }

        if (newJumpCount > 0)
        {
            console.log(`[PF] Found ${newJumpCount} new jump coordinates`);
        }
    }

    /**
     * @brief Builds 2D pathfinding grid with traversal costs based on environment
     */
    buildPathfindingGrid()
    {
        if (!this.startPosition || !this.goalPosition) 
        {
            console.log('[PF] ERROR: Start or goal position missing');
            return;
        }
        
        // Determine grid bounds (from start to goal plus some padding)
        const minX = Math.min(this.startPosition.x, this.goalPosition.x) - 5;
        const maxX = Math.max(this.startPosition.x, this.goalPosition.x) + 5;
        const minZ = Math.min(this.startPosition.z, this.goalPosition.z) - 5;
        const maxZ = Math.max(this.startPosition.z, this.goalPosition.z) + 5;
        
        let gridCells = 0;

        // Build grid with costs
        for (let x = minX; x <= maxX; x++) 
        {
            for (let z = minZ; z <= maxZ; z++) 
            {
                const coordKey = `${x},${z}`;
                let cost = 1; // Default block cost
                
                // Check if coordinate is marked as impassable
                if (this.impassableCoords.has(coordKey)) 
                {
                    cost = Infinity;
                } 

                else 
                {
                    // Check block type at feet level for special costs
                    const block = this.actions.block_at(x, this.startPosition.y, z);
                    if (block) 
                    {
                        cost = BLOCK_COSTS[block.name] || 1;
                    }
                }
                
                this.grid.set(coordKey, cost);
                gridCells++;
            }
        }
        
        console.log(`[PF] Grid built: ${maxX - minX + 1}x${maxZ - minZ + 1} = ${gridCells} cells`);
    }

    /**
     * @brief Updates existing pathfinding grid with new cost information
     */
    updatePathfindingGrid()
    {
        if (!this.startPosition || !this.goalPosition) 
        {
            console.log('[PF] ERROR: Start or goal position missing');
            return;
        }
        
        const botPos = this.actions.position();
        let updatedCells = 0;
        
        // Update grid costs around bot's current position
        for (let dx = -SCAN_RADIUS - 2; dx <= SCAN_RADIUS + 2; dx++) 
        {
            for (let dz = -SCAN_RADIUS - 2; dz <= SCAN_RADIUS + 2; dz++) 
            {
                const x = botPos.x + dx;
                const z = botPos.z + dz;
                const coordKey = `${x},${z}`;
                
                let cost = 1; // Default block cost
                
                // Check if coordinate is marked as impassable
                if (this.impassableCoords.has(coordKey)) 
                {
                    cost = Infinity;
                } 

                else 
                {
                    // Check block type at feet level for special costs
                    const block = this.actions.block_at(x, botPos.y, z);
                    if (block) 
                    {
                        cost = BLOCK_COSTS[block.name] || 1;
                    }
                }
                
                // Update grid if this position exists in our grid
                if (this.grid.has(coordKey))
                {
                    const oldCost = this.grid.get(coordKey);
                    if (oldCost !== cost)
                    {
                        this.grid.set(coordKey, cost);
                        updatedCells++;
                    }
                }
                
                else
                {
                    // Add new grid cell if within reasonable bounds
                    this.grid.set(coordKey, cost);
                    updatedCells++;
                }
            }
        }
        
        if (updatedCells > 0)
        {
            console.log(`[PF] Updated ${updatedCells} grid cells`);
        }
    }

    //* A-STAR PATH CALCULATION

    /**
     * @brief Implements A* pathfinding algorithm to find optimal path
     * @returns {Array} Array of {x, z} coordinates representing the path
     */
    calculateAStarPath()
    {
        this.currentPosition = this.actions.position()

        if (!this.currentPosition || !this.goalPosition) 
        {
            console.log('[PF] ERROR: Start or goal position not set');
            return [];
        }
        
        const hCost = this.manhattanDistance(
            this.currentPosition.x, this.currentPosition.z,
            this.goalPosition.x, this.goalPosition.z
        );
        const startNode = new PathNode(this.currentPosition.x, this.currentPosition.z, 0, hCost);

        const openSet = [startNode];  // Nodes to be evaluated
        const closedSet = new Set();  // Nodes already evaluated (using "x,z" strings)
        const allNodes = new Map();   // All created nodes for quick lookup
        
        allNodes.set(`${startNode.x},${startNode.z}`, startNode);
        
        while (openSet.length > 0) 
        {        
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
            
            // Check if the reconstructed Path is at the goal
            if (currentNode.x === this.goalPosition.x && currentNode.z === this.goalPosition.z) 
            {
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
                
                // Create new neighbor node
                if (!neighborNode) 
                {
                    const hCost = this.manhattanDistance(
                        neighborX, neighborZ, 
                        this.goalPosition.x, this.goalPosition.z
                    );

                    neighborNode = new PathNode(neighborX, neighborZ, tentativeGCost, hCost, currentNode);
                    allNodes.set(neighborKey, neighborNode);
                    openSet.push(neighborNode);
                }

                // Better path to this neighbor found
                else if (tentativeGCost < neighborNode.gCost) 
                {
                    const hCost = this.manhattanDistance(
                        neighborX, neighborZ, 
                        this.goalPosition.x, this.goalPosition.z
                    );

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
        return [];
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

    //* MOVEMENT RESPONSE

    /**
     * @brief Gets next movement action based on A* path and immediate obstacles
     * @returns {Object} Movement decision with action type and parameters
     */
    getNextMovement()
    {
        this.currentPosition = this.actions.position();
        //* console.log(`[PF] Bot position: x:${this.currentPosition.x}, y:${this.currentPosition.y}, z:${this.currentPosition.z}`);

        // Check if we've reached the goal using coordinates
        if (this.isAtGoal()) 
        {
            console.log('[PF] Goal reached');
            return {action: 'idle'};
        }
        
        // Check if we need to perform incremental scan
        if (this.stepCount % RESCAN_INTERVAL === 0 && this.lastRescanStep !== this.stepCount) 
        {
            console.log('rescan')
            this.performEnvironmentScan();
            
            // Recalculate path with updated environment
            this.calculateAStarPath();
            this.currentPathIndex = 0;
            this.lastRescanStep = this.stepCount;
        }

        if (this.currentPathIndex >= this.currentPath.length)
        {
            console.log('[PF] Path completed but goal not reached');
            this.calculateAStarPath();
            this.currentPathIndex = 0;

            if (this.currentPath.length === 0)
            {
                console.log('[PF] No path found, setting idle');
                return {action: 'idle'};
            }
        }

        const nextStep = this.currentPath[this.currentPathIndex];
        const currentPos = this.actions.position();
        
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
        
        // Check if next position requires jumping
        const nextCoordKey = `${nextStep.x},${nextStep.z}`;
        if (this.jumpCoords.has(nextCoordKey)) 
        {
            console.log(`[PF] Jump required for next step (${nextStep.x},${nextStep.z})`);
            return {action: 'jump_and_move', direction: this.currentDirection};
        }
        
        // Regular movement
        return {action: 'move', direction: this.currentDirection};
    }

    /**
     * @brief Checks if bot has reached the goal position
     * @returns {boolean} True if bot is at goal coordinates
     */
    isAtGoal()
    {
        if (!this.goalPosition) return false;
        
        const currentPos = this.actions.position();
        return currentPos.x === this.goalPosition.x && 
               currentPos.z === this.goalPosition.z;
    }
    
    /**
     * @brief Marks a step as completed only when bot actually moves to new coordinates
     * @param {string} direction - Direction that was completed (for compatibility)
     */
    completeStep(direction)
    {
        const currentPos = this.actions.position();
        
        // Add current position to history
        this.positionHistory.push({
            x: currentPos.x,
            z: currentPos.z,
            timestamp: Date.now()
        });
        
        // Keep only the last N positions
        if (this.positionHistory.length > this.maxHistorySize) {
            this.positionHistory.shift();
        }
        
        if (this.currentPathIndex < this.currentPath.length) 
        {
            const targetStep = this.currentPath[this.currentPathIndex];
            
            // Only increment if bot is at target coordinates
            if (currentPos.x === targetStep.x && currentPos.z === targetStep.z) 
            {
                this.currentPathIndex++;
                this.stepCount++;
                const remaining = this.currentPath.length - this.currentPathIndex;
                console.log(`[PF] Step ${this.currentPathIndex}/${this.currentPath.length} complete (${remaining} left)`);
                
                // Reset history on successful step completion
                this.positionHistory = [];
            }
            
            else 
            {
                console.log(`[PF] Step not completed - bot at (${currentPos.x},${currentPos.z}), target (${targetStep.x},${targetStep.z})`);

                // Perform a rescan
                // this.performEnvironmentScan();
                
                // Check if bot is stuck (same position for 5 iterations)
                if (this.isBotStuck())
                {
                    console.log(`[PF] Bot detected as stuck - forcing unstuck movement`);
                    const unstuckDirection = this.getPerpendicularDirection(this.currentDirection);
                    this.actions.step(unstuckDirection);
                    
                    // Reset history after forcing movement
                    this.positionHistory = [];
                }
            }
        }
    }

    /**
     * @brief Gets perpendicular direction for unsticking bot
     * @param {string} direction - Current direction
     * @returns {string} Perpendicular direction (90 degrees counterclockwise)
     */
    getPerpendicularDirection(direction)
    {
        const perpendicularMap =
        {
            'north': 'east',
            'east': 'south', 
            'south': 'west',
            'west': 'north'
        };
        
        return perpendicularMap[direction] || 'west';
    }

    /**
     * @brief Checks if bot is stuck by comparing recent positions
     * @returns {boolean} True if bot hasn't moved in recent iterations
     */
    isBotStuck()
    {
        // Need full history to detect stuck
        if (this.positionHistory.length < this.maxHistorySize)
        {
            return false;
        }
        
        // Compare all positions in history
        const firstPos = this.positionHistory[0];
        
        for (let i = 1; i < this.positionHistory.length; i++)
        {
            const pos = this.positionHistory[i];
            if (pos.x !== firstPos.x || pos.z !== firstPos.z)
            {
                return false; // Movement found
            }
        }
        
        console.log(`[PF] Bot stuck at position (${firstPos.x}, ${firstPos.z}) for ${this.maxHistorySize} iterations`);
        return true;
    }
}

module.exports = SimplePathfinder;