/** *************************************************************************************
   
    * @file        behaviors.js
    * @brief       Implementation of autonomous navigation state machine for bot movement
    * @author      Agustín I. Galdeman
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-07
    * @version     1.0 - Modified for continuous movement

    ************************************************************************************* */

// TODO fix:
//? Si el terreno disminuye de altura, el bot no sigue avanzando
//! Parece que cuando cambia de dirección, lo hace dos veces en vez de una


/* **************************************************************************************
    * CONSTANTS AND STATIC DATA *
   ************************************************************************************** */

// Available cardinal directions for navigation
const NAVIGATION_DIRECTIONS = ['north', 'east', 'south', 'west'];

// Maximum consecutive head-level blocks before direction change
const MAX_HEAD_BLOCKS = 2;

// Direction offset mappings with yaw angles
const DIRECTION_OFFSETS =
{
    north: { x: 0, z: -1, yaw: Math.PI },
    south: { x: 0, z: 1, yaw: 0 },
    west: { x: -1, z: 0, yaw: Math.PI / 2 },       
    east: { x: 1, z: 0, yaw: -Math.PI / 2 }
};

// State machine cycle delay in milliseconds
const STATE_CYCLE_DELAY = 100;

// Movement execution delay in milliseconds
const MOVEMENT_DELAY = 150;

// Direction change stabilization delay in milliseconds
const DIRECTION_CHANGE_DELAY = 300;

// Jump timing delay in milliseconds
const JUMP_DELAY = 100;


/* **************************************************************************************
    * CLASS IMPLEMENTATIONS *
   ************************************************************************************** */

/**
 * @class NavigationStateMachine
 * @brief Autonomous navigation system using continuous movement with obstacle detection
 */
class NavigationStateMachine
{
    /**
     * @brief Constructor initializes the navigation state machine
     * @param {Object} bot - Mineflayer bot instance
     * @param {Object} actions - BotActions instance for movement control
     */
    constructor(bot, actions)
    {
        this.bot = bot;
        this.actions = actions;
        this.currentState = 'IDLE';
        this.targetDirection = 'north';
        this.isRunning = false;
        this.directions = NAVIGATION_DIRECTIONS;
        this.currentDirectionIndex = 0;
        this.consecutiveHeadBlocks = 0;
        this.isJumping = false;
    }

    //* STATE DEFINITIONS

    /**
     * @brief Available states for the navigation state machine
     * @static
     */
    static STATES =
    {
        IDLE: 'IDLE',
        MOVING: 'MOVING',
        CHANGING_DIRECTION: 'CHANGING_DIRECTION'
    };

    //* STATE MACHINE CONTROL

    /**
     * @brief Initializes and starts autonomous navigation in specified direction
     * @param {string} direction - Initial cardinal direction for navigation
     */
    async start(direction = 'north')
    {
        console.log(`Starting autonomous navigation towards ${direction}`);
        this.targetDirection = direction;
        this.currentDirectionIndex = this.directions.indexOf(direction);
        this.isRunning = true;
        this.currentState = NavigationStateMachine.STATES.MOVING;
        this.consecutiveHeadBlocks = 0;
        
        const directionOffset = this.getDirectionOffset(this.targetDirection);
        await this.actions.look(directionOffset.yaw, 0);
        
        await this.run();
    }

    /**
     * @brief Main state machine execution loop with continuous movement
     */
    async run()
    {
        while (this.isRunning)
        {
            try
            {
                switch (this.currentState)
                {
                    case NavigationStateMachine.STATES.IDLE:
                        await this.handleIdle();
                        break;
                    case NavigationStateMachine.STATES.MOVING:
                        await this.handleMoving();
                        break;
                    case NavigationStateMachine.STATES.CHANGING_DIRECTION:
                        await this.handleChangingDirection();
                        break;
                }
                
                await this.sleep(STATE_CYCLE_DELAY);
            }
            
            catch (error)
            {
                console.error(`Error in state ${this.currentState}:`, error.message);
                // En caso de error, continúa intentando moverse
                this.currentState = NavigationStateMachine.STATES.MOVING;
            }
        }
    }

    /**
     * @brief Stops the autonomous navigation system
     */
    stop()
    {
        console.log('Stopping autonomous navigation');
        this.isRunning = false;
        this.currentState = NavigationStateMachine.STATES.IDLE;
    }

    //* STATE HANDLERS

    /**
     * @brief Handles IDLE state by transitioning to movement
     */
    async handleIdle()
    {
        console.log('Bot is idle, starting movement...');
        this.currentState = NavigationStateMachine.STATES.MOVING;
    }

    /**
     * @brief Handles MOVING state with continuous movement and obstacle detection
     */
    async handleMoving()
    {
        // SIEMPRE intentar moverse - esta es la clave del cambio
        const movementPromise = this.executeMovement();
        
        // Verificar obstáculos mientras se mueve
        const shouldChangeDirection = this.checkForHeadObstacles();
        
        if (shouldChangeDirection)
        {
            console.log(`Head obstacle detected ${this.consecutiveHeadBlocks} times, changing direction`);
            this.currentState = NavigationStateMachine.STATES.CHANGING_DIRECTION;
            return;
        }
        
        // Ejecutar el movimiento
        await movementPromise;
        
        await this.sleep(MOVEMENT_DELAY);
    }

    /**
     * @brief Executes movement with simultaneous jump if needed
     */
    async executeMovement()
    {
        const currentPos = this.actions.position();
        const direction = this.getDirectionOffset(this.targetDirection);
        
        // Verificar si hay bloque a nivel de pies
        const feetBlock = this.actions.block_at
        (
            currentPos.x + direction.x, 
            currentPos.y, 
            currentPos.z + direction.z
        );
        
        const needsJump = this.isBlockSolid(feetBlock);
        
        // Si necesita saltar, ejecutar salto simultáneamente con el movimiento
        if (needsJump && !this.isJumping)
        {
            console.log(`Jumping over ${feetBlock ? feetBlock.name : 'unknown'} while moving ${this.targetDirection}`);
            this.isJumping = true;
            this.actions.jump();
            
            // Reset jump flag después de un tiempo
            setTimeout(() => {
                this.isJumping = false;
            }, 500);
            
            await this.sleep(JUMP_DELAY);
        }
        
        try
        {
            // SIEMPRE ejecutar step, sin importar si hay obstáculos menores
            const moveSucceeded = await this.actions.step(this.targetDirection);
            
            if (moveSucceeded)
            {
                console.log(`Successfully moved ${this.targetDirection}`);
                // Reset contador de obstáculos de cabeza si el movimiento fue exitoso
                this.consecutiveHeadBlocks = 0;
            }
            else
            {
                console.log(`Movement blocked but continuing to try...`);
            }
        }
        
        catch (error)
        {
            console.log(`Movement error: ${error.message}, but continuing...`);
        }
    }

    /**
     * @brief Checks for head-level obstacles that would require direction change
     * @returns {boolean} True if direction should be changed
     */
    checkForHeadObstacles()
    {
        const currentPos = this.actions.position();
        const direction = this.getDirectionOffset(this.targetDirection);
        
        // Verificar bloque a altura de cabeza
        const headBlock = this.actions.block_at
        (
            currentPos.x + direction.x, 
            currentPos.y + 1, 
            currentPos.z + direction.z
        );
        
        const headBlocked = this.isBlockSolid(headBlock);
        
        if (headBlocked)
        {
            this.consecutiveHeadBlocks++;
            console.log(`Head blocked by ${headBlock.name} (${this.consecutiveHeadBlocks}/${MAX_HEAD_BLOCKS})`);
            
            if (this.consecutiveHeadBlocks >= MAX_HEAD_BLOCKS)
            {
                return true; // Cambiar dirección
            }
        }
        else
        {
            // Si no hay bloque en la cabeza, resetear contador
            if (this.consecutiveHeadBlocks > 0)
            {
                console.log(`Head clear, resetting head block counter`);
                this.consecutiveHeadBlocks = 0;
            }
        }
        
        return false; // Continuar en la misma dirección
    }

    /**
     * @brief Handles CHANGING_DIRECTION state with direction rotation and orientation update
     */
    async handleChangingDirection()
    {
        console.log('Executing direction change...');
        
        this.currentDirectionIndex = (this.currentDirectionIndex + 1) % this.directions.length;
        this.targetDirection = this.directions[this.currentDirectionIndex];
        
        console.log(`Direction changed to: ${this.targetDirection}`);
        
        const directionOffset = this.getDirectionOffset(this.targetDirection);
        await this.actions.look(directionOffset.yaw, 0);
        
        this.consecutiveHeadBlocks = 0;
        this.currentState = NavigationStateMachine.STATES.MOVING;
        
        await this.sleep(DIRECTION_CHANGE_DELAY);
    }

    //* UTILITY AND HELPER FUNCTIONS

    /**
     * @brief Retrieves direction offset data including movement vectors and yaw angle
     * @param {string} direction - Cardinal direction name
     * @returns {Object} Direction offset object with x, z, and yaw properties
     */
    getDirectionOffset(direction)
    {return DIRECTION_OFFSETS[direction] || DIRECTION_OFFSETS.north;}

    /**
     * @brief Determines if a block is solid and blocks movement
     * @param {Object|null} block - Block object to analyze
     * @returns {boolean} True if block is solid, false otherwise
     */
    isBlockSolid(block)
    {
        if (!block || block.name === 'air')
            {return false;}
        
        const nonSolidBlocks = ['water', 'lava', 'grass', 'tall_grass', 'fern', 'large_fern'];
        return !nonSolidBlocks.includes(block.name);
    }

    /**
     * @brief Creates a promise-based delay for timing control
     * @param {number} ms - Delay duration in milliseconds
     * @returns {Promise} Promise that resolves after specified delay
     */
    sleep(ms)
    {return new Promise(resolve => setTimeout(resolve, ms));}

    //* STATE INFORMATION AND DEBUGGING

    /**
     * @brief Retrieves current state machine status for debugging
     * @returns {Object} State information object
     */
    getState()
    {
        return {
            currentState: this.currentState,
            targetDirection: this.targetDirection,
            isRunning: this.isRunning,
            position: this.actions.position(),
            consecutiveHeadBlocks: this.consecutiveHeadBlocks,
            isJumping: this.isJumping
        };
    }

    /**
     * @brief Manually sets navigation direction for debugging purposes
     * @param {string} direction - New target direction
     */
    setDirection(direction)
    {
        if (this.directions.includes(direction))
        {
            this.targetDirection = direction;
            this.currentDirectionIndex = this.directions.indexOf(direction);
            this.consecutiveHeadBlocks = 0;
            console.log(`Manual direction change to: ${direction}`);
        }
        
        else
            {console.log(`Invalid direction: ${direction}`);}
    }
}

module.exports = NavigationStateMachine;