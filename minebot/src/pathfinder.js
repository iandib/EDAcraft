/** *************************************************************************************
   
    * @file        pathfinder.js
    * @brief       A* pathfinding algorithm with 3D environment scanning for bot navigation
    * @author      Agustín I. Galdeman
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-27
    * @version     3.2 - Incremental scanning and proper goal detection

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

// Rescan environment every N steps
const RESCAN_INTERVAL = 5;


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
        
        // Set of impassable coordinates from 3D environment scanning
        this.impassableCoords = new Set(); // Stores "x,z" strings
        
        // Goal-based navigation with A* path
        this.goalPosition = null;
        this.currentPath = [];        // Array of {x, z} coordinates
        this.currentPathIndex = 0;    // Current step in the path
        this.isGoalMode = false;
        this.isIdle = false;
        
        // Environment scanning results - persistent across scans
        this.environmentData = new Map(); // Key: "x,y,z", Value: block info
        
        // Step counter for periodic rescanning
        this.stepCount = 0;
        this.lastRescanStep = -1;
        
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

        // Record and print the spawn point position
        const spawnPoint = this.actions.spawnPoint();
        
        this.goalPosition = {x, y, z};
        this.isGoalMode = true;
        this.isIdle = false;
        this.currentPathIndex = 0;
        this.stepCount = 0;
        
        // Perform initial environment scan and build grid
        this.performInitialEnvironmentScan();
        
        // Calculate A* path from start to goal
        this.calculateAStarPath();
        
        console.log(`[PF] Goal set complete. Path has ${this.currentPath.length} steps`);
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

    //! Al igual que se guardan las impassableCoords, guardar jumpCoords
    /**
     * @brief Analyzes scanned environment and updates impassable coordinates
     */
    reactToEnvironment()
    {
        const botPos = this.actions.position();
        let newImpassableCount = 0;
        
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
                
                if (hasHeadBlock || (hasFeetBlock && hasAboveBlock)) 
                {
                    if (!this.impassableCoords.has(coordKey)) {
                        newImpassableCount++;
                    }
                    this.impassableCoords.add(coordKey);
                }
                else 
                {
                    // Position is now passable, remove from impassable set if it was there
                    if (this.impassableCoords.has(coordKey)) {
                        this.impassableCoords.delete(coordKey);
                    }
                }
            }
        }
        
        if (newImpassableCount > 0) {
            console.log(`[PF] Found ${newImpassableCount} new impassable coordinates`);
        }
    }

    //! Unir los dos métodos de EnvironmentScan, agregar una flag para verificar si debe hacer un clear al inicio o no
    /**
     * @brief Performs initial full environment scan and builds grid
     */
    performInitialEnvironmentScan()
    {
        // Clear data for initial scan
        this.impassableCoords.clear();
        this.grid.clear();
        this.environmentData.clear();
        
        // Scan current environment
        this.scanEnvironment();
        this.reactToEnvironment();
        
        // Build pathfinding grid with costs
        this.buildPathfindingGrid();
        console.log('[PF] Initial environment scan complete');
    }

    /**
     * @brief Performs incremental environment scan and updates grid
     */
    performIncrementalEnvironmentScan()
    {
        // Scan current environment (adds to existing data)
        this.scanEnvironment();
        this.reactToEnvironment();
        
        // Update pathfinding grid with new costs
        this.updatePathfindingGrid();
        console.log('[PF] Incremental environment scan complete');
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
                let cost = 1; // Default cost for air/passable blocks
                
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

    //? Verificar si el escaneo de radio en esto se pisa con el de reactToEnvironment
    /**
     * @brief Updates existing pathfinding grid with new cost information
     */
    updatePathfindingGrid()
    {
        if (!this.startPosition || !this.goalPosition) 
        {
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
                
                let cost = 1; // Default cost for air/passable blocks
                
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
                if (this.grid.has(coordKey)) {
                    const oldCost = this.grid.get(coordKey);
                    if (oldCost !== cost) {
                        this.grid.set(coordKey, cost);
                        updatedCells++;
                    }
                } else {
                    // Add new grid cell if within reasonable bounds
                    this.grid.set(coordKey, cost);
                    updatedCells++;
                }
            }
        }
        
        if (updatedCells > 0) {
            console.log(`[PF] Updated ${updatedCells} grid cells`);
        }
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
        this.currentPosition = this.actions.position()

        if (!this.currentPosition || !this.goalPosition) 
        {
            console.log('[PF] ERROR: Start or goal position not set');
            return [];
        }
        
        const startNode = new PathNode(
            this.currentPosition.x, 
            this.currentPosition.z, 
            0, 
            this.manhattanDistance(this.currentPosition.x, this.currentPosition.z, this.goalPosition.x, this.goalPosition.z)
        );
        
        const openSet = [startNode];  // Nodes to be evaluated
        const closedSet = new Set();  // Nodes already evaluated (using "x,z" strings)
        const allNodes = new Map();   // All created nodes for quick lookup
        
        allNodes.set(`${startNode.x},${startNode.z}`, startNode);
        
        let iterations = 0;
        while (openSet.length > 0) 
        {
            //! Quitar iterations, no es necesario
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
            path.unshift(
            { 
                x: currentNode.x, 
                z: currentNode.z 
            });
            currentNode = currentNode.parent;
        }
        
        console.log(`[PF] Path reconstructed: ${path.length} steps`);
        return path;
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

    //! Usar el estado idle en lugar del método
    //! 
    /**
     * @brief Gets next movement action based on A* path and immediate obstacles
     * @returns {Object} Movement decision with action type and parameters
     */
    getNextMovement()
    {
        this.currentPosition = this.actions.position();
        console.log(`[PF] Bot position: x:${this.currentPosition.x}, y:${this.currentPosition.y}, z:${this.currentPosition.z}`);

        // If idle, don't move
        if (this.isIdle) 
        {
            return { action: 'idle' };
        }

        // Goal-based A* movement
        if (this.isGoalMode) 
        {
            // Check if we've reached the goal using coordinates
            if (this.isAtGoal()) 
            {
                console.log('[PF] Goal reached!');
                this.isGoalMode = false;
                return { action: 'idle' };
            }
            
            //? Chequear si es necesario la verificación de stepCount > 0 (seteando lastRescanSep a 0 inicial, puede que no sea necesario)
            // Check if we need to perform incremental scan
            if (this.stepCount > 0 && this.stepCount % RESCAN_INTERVAL === 0 && this.lastRescanStep !== this.stepCount) 
            {
                console.log('rescan')
                this.performIncrementalEnvironmentScan();
                
                // Recalculate path with updated environment
                this.calculateAStarPath();
                this.currentPathIndex = 0;
                this.lastRescanStep = this.stepCount;
            }

            if (this.currentPathIndex >= this.currentPath.length)
            {
                console.log('[PF] Path completed but goal not reached, recalculating...');
                this.calculateAStarPath();
                this.currentPathIndex = 0;

                //? Verificar si este if es necesario
                if (this.currentPath.length === 0) {
                    console.log('[PF] No path found, setting idle');
                    this.setIdle();
                    return { action: 'idle' };
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
            //! En lugar de saltar obstáculos de esta manera, verificar si el bot se encuentra en una coordenada guardada en jumpCoords y ejecutar ese estado
            //! De lo contrario, ejecuta move o idle cuando corresponda
            // Check immediate obstacles in front of bot
            const frontObstacle = this.checkImmediateObstacle();
            
            if (frontObstacle.canJump) 
            {
                return {
                    action: 'jump_and_move',
                    direction: this.currentDirection
                };
            } 
            else if (frontObstacle.isBlocked) 
            {
                console.log(`[PF] Path blocked, rescanning and recalculating...`);
                // Rescan environment and recalculate path
                this.performIncrementalEnvironmentScan();
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

    //! Eliminar este método, la lógica está repetida de reactToEnvironment()
    /**
     * @brief Checks immediate obstacle in front of bot (similar to old scanEnvironment logic)
     * @returns {Object} Obstacle information with canJump and isBlocked flags
     */
    checkImmediateObstacle()
    {
        const pos = this.actions.position();
        const offset = DIRECTION_OFFSETS[this.currentDirection];
        const frontPos = 
        { 
            x: pos.x + offset.x, 
            z: pos.z + offset.z 
        };
        
        // Check blocks at different heights in front
        const feetBlock = this.actions.block_at(frontPos.x, pos.y, frontPos.z);
        const headBlock = this.actions.block_at(frontPos.x, pos.y + 1, frontPos.z);
        const aboveBlock = this.actions.block_at(frontPos.x, pos.y + 2, frontPos.z);
        const overheadBlock = this.actions.block_at(pos.x, pos.y + 2, pos.z);
        
        const feetBlocked = feetBlock && feetBlock.name !== 'air';
        const headBlocked = headBlock && headBlock.name !== 'air';
        const aboveBlocked = aboveBlock && aboveBlock.name !== 'air';
        const overheadBlocked = overheadBlock && overheadBlock.name !== 'air';
        
        // Obstacle type A: Only feet blocked (can jump)
        if (feetBlocked && !headBlocked && !aboveBlocked && !overheadBlocked) 
        {
            return { canJump: true, isBlocked: false };
        }
        // Obstacle type B: Head blocked OR (feet blocked AND (overhead OR above)) - impassable
        else if (headBlocked || (feetBlocked && (overheadBlocked || aboveBlocked))) 
        {
            return { canJump: false, isBlocked: true };
        }
        
        return { canJump: false, isBlocked: false };
    }

    //! Arreglar la condición que verifica si se dio un step chequeando coordenadas
    /**
     * @brief Marks a step as completed in the A* path
     * @param {string} direction - Direction that was completed (for compatibility)
     */
    completeStep(direction)
    {
        if (this.isGoalMode && this.currentPathIndex < this.currentPath.length) 
        {
            this.currentPathIndex++;
            this.stepCount++;
            const remaining = this.currentPath.length - this.currentPathIndex;
            console.log(`[PF] Step ${this.currentPathIndex}/${this.currentPath.length} complete (${remaining} left)`);
        }
    }

    //! En lugar de tener métodos idle, directamente pasar al estado idle en la máquina de estados
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