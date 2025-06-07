/** *************************************************************************************
   
    * @file        behaviors.js
    * @brief       Implementation of autonomous navigation state machine for bot movement
    * @author      Agustín I. Galdeman
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-07
    * @version     1.0

    ************************************************************************************* */

// TODO fix:
//! Si el terreno disminuye de altura, el bot no sigue avanzando
//! Parece que cuando cambia de dirección, lo hace dos veces en vez de una


/* **************************************************************************************
    * CONSTANTS AND STATIC DATA *
   ************************************************************************************** */

// Available cardinal directions for navigation
const NAVIGATION_DIRECTIONS = ['north', 'east', 'south', 'west'];

// Maximum consecutive failures before direction change
const MAX_CONSECUTIVE_FAILURES = 3;

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
const MOVEMENT_DELAY = 200;

// Direction change stabilization delay in milliseconds
const DIRECTION_CHANGE_DELAY = 300;

// Jump sequence timing delay in milliseconds
const JUMP_SEQUENCE_DELAY = 300;

// Maximum depth for solid ground detection
const MAX_GROUND_CHECK_DEPTH = 5;


/* **************************************************************************************
    * CLASS IMPLEMENTATIONS *
   ************************************************************************************** */

/**
 * @class NavigationStateMachine
 * @brief Autonomous navigation system using finite state machine for obstacle handling
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
        this.lastPosition = null;
        this.consecutiveFailures = 0;
        this.maxConsecutiveFailures = MAX_CONSECUTIVE_FAILURES;
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
        CHECKING_OBSTACLES: 'CHECKING_OBSTACLES',
        JUMPING: 'JUMPING',
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
        this.consecutiveFailures = 0;
        
        const directionOffset = this.getDirectionOffset(this.targetDirection);
        await this.actions.look(directionOffset.yaw, 0);
        
        this.lastPosition = this.actions.position();
        
        await this.run();
    }

    /**
     * @brief Main state machine execution loop with error handling
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
                    case NavigationStateMachine.STATES.CHECKING_OBSTACLES:
                        await this.handleCheckingObstacles();
                        break;
                    case NavigationStateMachine.STATES.JUMPING:
                        await this.handleJumping();
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
                this.consecutiveFailures++;
                
                if (this.consecutiveFailures >= this.maxConsecutiveFailures)
                {
                    console.log('Too many consecutive failures, changing direction');
                    this.currentState = NavigationStateMachine.STATES.CHANGING_DIRECTION;
                    this.consecutiveFailures = 0;
                } 
                
                else 
                    {this.currentState = NavigationStateMachine.STATES.CHECKING_OBSTACLES;}
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
     * @brief Handles MOVING state with movement execution and success tracking
     */
    async handleMoving()
    {
        console.log(`Moving ${this.targetDirection}...`);
        
        try
        {
            const moveSucceeded = await this.actions.step(this.targetDirection);
            
            if (moveSucceeded)
            {
                console.log(`Successfully moved ${this.targetDirection}`);
                this.consecutiveFailures = 0;
                this.lastPosition = this.actions.position();
                
                await this.sleep(MOVEMENT_DELAY);
            }
            
            else
            {
                console.log('Movement failed, checking obstacles...');
                this.consecutiveFailures++;
                this.currentState = NavigationStateMachine.STATES.CHECKING_OBSTACLES;
            }
        }
        
        catch (error)
        {
            console.log(`Movement blocked: ${error.message}`);
            this.consecutiveFailures++;
            this.currentState = NavigationStateMachine.STATES.CHECKING_OBSTACLES;
        }
    }

    /**
     * @brief Handles CHECKING_OBSTACLES state with terrain analysis and path decision
     */
    async handleCheckingObstacles()
    {
        console.log('Analyzing obstacle pattern...');
        
        const currentPos = this.actions.position();
        const direction = this.getDirectionOffset(this.targetDirection);
        
        const feetBlock = this.actions.block_at
        (
            currentPos.x + direction.x, 
            currentPos.y, 
            currentPos.z + direction.z
        );
        
        const headBlock = this.actions.block_at
        (
            currentPos.x + direction.x, 
            currentPos.y + 1, 
            currentPos.z + direction.z
        );
        
        const feetBlocked = this.isBlockSolid(feetBlock);
        const headBlocked = this.isBlockSolid(headBlock);
        
        console.log(`Feet level: ${feetBlock ? feetBlock.name : 'air'} (blocked: ${feetBlocked})`);
        console.log(`Head level: ${headBlock ? headBlock.name : 'air'} (blocked: ${headBlocked})`);
        
        if (headBlocked)
        {
            console.log('Head blocked - changing direction');
            this.currentState = NavigationStateMachine.STATES.CHANGING_DIRECTION;
        }
        
        else if (feetBlocked && !headBlocked)
        {
            console.log('Only feet blocked - attempting to jump');
            this.currentState = NavigationStateMachine.STATES.JUMPING;
        } 
        
        else if (!feetBlocked && !headBlocked)
        {
            let foundSolidGround = false;
            for (let i = 1; i <= MAX_GROUND_CHECK_DEPTH; i++)
            {
                const lowerBlock = this.actions.block_at
                (
                    currentPos.x + direction.x,
                    currentPos.y - i,
                    currentPos.z + direction.z
                );
                
                if (this.isBlockSolid(lowerBlock))
                {
                    foundSolidGround = true;
                    break;
                }
            }
            
            if (foundSolidGround)
            {
                console.log('Lower terrain detected - resuming movement');
                this.currentState = NavigationStateMachine.STATES.MOVING;
            }
            
            else if (this.consecutiveFailures >= 2)
            {
                console.log('No solid ground found and multiple failures - changing direction');
                this.currentState = NavigationStateMachine.STATES.CHANGING_DIRECTION;
            }
            
            else
            {
                console.log('Path appears clear - resuming movement');
                this.currentState = NavigationStateMachine.STATES.MOVING;
            }
        }
    }

    /**
     * @brief Handles JUMPING state with jump-move sequence execution
     */
    async handleJumping()
    {
        console.log('Executing jump sequence...');
        
        try
        {
            this.actions.jump();
            
            await this.sleep(JUMP_SEQUENCE_DELAY);
            
            const moveSucceeded = await this.actions.step(this.targetDirection);
            
            if (moveSucceeded)
            {
                console.log('Jump and move sequence completed successfully');
                this.consecutiveFailures = 0;
                this.lastPosition = this.actions.position();
                this.currentState = NavigationStateMachine.STATES.MOVING;
            }
            
            else
            {
                console.log('Jump sequence failed - changing direction');
                this.consecutiveFailures++;
                this.currentState = NavigationStateMachine.STATES.CHANGING_DIRECTION;
            }   
        }
        
        catch (error)
        {
            console.log('Jump sequence failed - changing direction');
            this.consecutiveFailures++;
            this.currentState = NavigationStateMachine.STATES.CHANGING_DIRECTION;
        }
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
        
        this.consecutiveFailures = 0;
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
            consecutiveFailures: this.consecutiveFailures
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
            console.log(`Manual direction change to: ${direction}`);
        }
        
        else
            {console.log(`Invalid direction: ${direction}`);}
    }
}

module.exports = NavigationStateMachine;
