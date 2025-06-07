class NavigationStateMachine {
    constructor(bot, actions) {
        this.bot = bot;
        this.actions = actions;
        this.currentState = 'IDLE';
        this.targetDirection = 'north';
        this.isRunning = false;
        this.directions = ['north', 'east', 'south', 'west'];
        this.currentDirectionIndex = 0;
        this.lastPosition = null;
        this.consecutiveFailures = 0;
        this.maxConsecutiveFailures = 3;
    }

    // Estados posibles
    static STATES = {
        IDLE: 'IDLE',
        MOVING: 'MOVING',
        CHECKING_OBSTACLES: 'CHECKING_OBSTACLES',
        JUMPING: 'JUMPING',
        CHANGING_DIRECTION: 'CHANGING_DIRECTION'
    };

    // Iniciar el comportamiento de navegación
    async start(direction = 'north') {
        console.log(`Starting autonomous navigation towards ${direction}`);
        this.targetDirection = direction;
        this.currentDirectionIndex = this.directions.indexOf(direction);
        this.isRunning = true;
        this.currentState = NavigationStateMachine.STATES.MOVING;
        this.consecutiveFailures = 0;
        
        // Configurar la dirección inicial UNA SOLA VEZ
        const directionOffset = this.getDirectionOffset(this.targetDirection);
        await this.actions.look(directionOffset.yaw, 0);
        
        // Guardar posición inicial
        this.lastPosition = this.actions.position();
        
        await this.run();
    }

    // Bucle principal de la máquina de estados
    async run() {
        while (this.isRunning) {
            try {
                switch (this.currentState) {
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
                
                // Pausa pequeña para evitar sobrecargar el CPU
                await this.sleep(100);
                
            } catch (error) {
                console.error(`Error in state ${this.currentState}:`, error.message);
                this.consecutiveFailures++;
                
                if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
                    console.log('Too many consecutive failures, changing direction');
                    this.currentState = NavigationStateMachine.STATES.CHANGING_DIRECTION;
                    this.consecutiveFailures = 0;
                } else {
                    this.currentState = NavigationStateMachine.STATES.CHECKING_OBSTACLES;
                }
            }
        }
    }

    // Manejar estado IDLE
    async handleIdle() {
        console.log('Bot is idle, starting movement...');
        this.currentState = NavigationStateMachine.STATES.MOVING;
    }

    // Manejar estado MOVING
    async handleMoving() {
        console.log(`Moving ${this.targetDirection}...`);
        
        try {
            // Intentar moverse - step() ahora devuelve true/false
            const moveSucceeded = await this.actions.step(this.targetDirection);
            
            if (moveSucceeded) {
                console.log(`Successfully moved ${this.targetDirection}`);
                this.consecutiveFailures = 0;
                this.lastPosition = this.actions.position();
                
                // Pequeña pausa antes del siguiente movimiento
                await this.sleep(200);
            } else {
                console.log('Movement failed, checking obstacles...');
                this.consecutiveFailures++;
                this.currentState = NavigationStateMachine.STATES.CHECKING_OBSTACLES;
            }
        } catch (error) {
            console.log(`Movement blocked: ${error.message}`);
            this.consecutiveFailures++;
            this.currentState = NavigationStateMachine.STATES.CHECKING_OBSTACLES;
        }
    }

    // Manejar estado CHECKING_OBSTACLES
    async handleCheckingObstacles() {
        console.log('Analyzing obstacle pattern...');
        
        const currentPos = this.actions.position();
        const direction = this.getDirectionOffset(this.targetDirection);
        
        // Verificar bloque a nivel de los pies (posición actual)
        const feetBlock = this.actions.block_at(
            currentPos.x + direction.x, 
            currentPos.y, 
            currentPos.z + direction.z
        );
        
        // Verificar bloque a nivel de la cabeza (posición actual + 1)
        const headBlock = this.actions.block_at(
            currentPos.x + direction.x, 
            currentPos.y + 1, 
            currentPos.z + direction.z
        );
        
        const feetBlocked = this.isBlockSolid(feetBlock);
        const headBlocked = this.isBlockSolid(headBlock);
        
        console.log(`Feet level: ${feetBlock ? feetBlock.name : 'air'} (blocked: ${feetBlocked})`);
        console.log(`Head level: ${headBlock ? headBlock.name : 'air'} (blocked: ${headBlocked})`);
        
        // Lógica de decisión
        if (headBlocked) {
            // Si la cabeza está bloqueada, cambiar dirección inmediatamente
            console.log('Head blocked - changing direction');
            this.currentState = NavigationStateMachine.STATES.CHANGING_DIRECTION;
        } else if (feetBlocked && !headBlocked) {
            // Si solo los pies están bloqueados, intentar saltar
            console.log('Only feet blocked - attempting to jump');
            this.currentState = NavigationStateMachine.STATES.JUMPING;
        } else if (this.consecutiveFailures >= 2) {
            // Si no hay obstáculos obvios pero llevamos varios fallos, cambiar dirección
            console.log('No obvious obstacles but multiple failures - changing direction');
            this.currentState = NavigationStateMachine.STATES.CHANGING_DIRECTION;
        } else {
            // Si no hay obstáculos obvios, volver a intentar moverse
            console.log('Path appears clear - resuming movement');
            this.currentState = NavigationStateMachine.STATES.MOVING;
        }
    }

    // Verificar si un bloque es sólido
    isBlockSolid(block) {
        if (!block) return false;
        
        // Bloques que no son sólidos para el movimiento
        const nonSolidBlocks = [
            'air', 'water', 'lava', 'tall_grass', 'grass', 'fern', 'dead_bush',
            'dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet',
            'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip',
            'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'wither_rose',
            'sunflower', 'lilac', 'rose_bush', 'peony', 'wheat', 'carrots',
            'potatoes', 'beetroots', 'sugar_cane', 'kelp', 'seagrass',
            'cave_air', 'void_air'
        ];
        
        return !nonSolidBlocks.includes(block.name);
    }

    // Manejar estado JUMPING
    async handleJumping() {
        console.log('Executing jump sequence...');
        
        try {
            // Saltar primero
            this.actions.jump();
            
            // Esperar un poco para que el salto inicie
            await this.sleep(300);
            
            // Intentar moverse mientras está saltando
            const moveSucceeded = await this.actions.step(this.targetDirection);
            
            if (moveSucceeded) {
                console.log('Jump and move sequence completed successfully');
                this.consecutiveFailures = 0;
                this.lastPosition = this.actions.position();
                this.currentState = NavigationStateMachine.STATES.MOVING;
            } else {
                console.log('Jump sequence failed - changing direction');
                this.consecutiveFailures++;
                this.currentState = NavigationStateMachine.STATES.CHANGING_DIRECTION;
            }
            
        } catch (error) {
            console.log('Jump sequence failed - changing direction');
            this.consecutiveFailures++;
            this.currentState = NavigationStateMachine.STATES.CHANGING_DIRECTION;
        }
    }

    // Manejar estado CHANGING_DIRECTION
    async handleChangingDirection() {
        console.log('Executing direction change...');
        
        // Cambiar a la siguiente dirección
        this.currentDirectionIndex = (this.currentDirectionIndex + 1) % this.directions.length;
        this.targetDirection = this.directions[this.currentDirectionIndex];
        
        console.log(`Direction changed to: ${this.targetDirection}`);
        
        // Orientar el bot hacia la nueva dirección
        const directionOffset = this.getDirectionOffset(this.targetDirection);
        await this.actions.look(directionOffset.yaw, 0);
        
        // Reset de fallos consecutivos al cambiar dirección
        this.consecutiveFailures = 0;
        
        // Volver al estado de movimiento
        this.currentState = NavigationStateMachine.STATES.MOVING;
        
        // Pausa breve para asegurar que el cambio de vista se complete
        await this.sleep(300);
    }

    // Obtener offset de dirección y ángulo de rotación
    getDirectionOffset(direction) {
        const offsets = {
            north: { x: 0, z: -1, yaw: Math.PI },
            south: { x: 0, z: 1, yaw: 0 },
            west: { x: -1, z: 0, yaw: Math.PI / 2 },       
            east: { x: 1, z: 0, yaw: -Math.PI / 2 }
        };
        return offsets[direction] || offsets.north;
    }

    // Detener la máquina de estados
    stop() {
        console.log('Stopping autonomous navigation');
        this.isRunning = false;
        this.currentState = NavigationStateMachine.STATES.IDLE;
    }

    // Obtener estado actual para debugging
    getState() {
        return {
            currentState: this.currentState,
            targetDirection: this.targetDirection,
            isRunning: this.isRunning,
            position: this.actions.position(),
            consecutiveFailures: this.consecutiveFailures
        };
    }

    // Cambiar dirección manualmente (útil para debugging)
    setDirection(direction) {
        if (this.directions.includes(direction)) {
            this.targetDirection = direction;
            this.currentDirectionIndex = this.directions.indexOf(direction);
            console.log(`Manual direction change to: ${direction}`);
        } else {
            console.log(`Invalid direction: ${direction}`);
        }
    }

    // Utilidad para pausas
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = NavigationStateMachine;