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
        
        // Configurar la dirección inicial una sola vez
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
                await this.sleep(50);
                
            } catch (error) {
                console.error(`Error in state ${this.currentState}:`, error.message);
                this.currentState = NavigationStateMachine.STATES.CHECKING_OBSTACLES;
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
        
        const positionBefore = this.actions.position();
        
        try {
            // Intentar moverse sin cambiar la dirección de vista
            await this.actions.step(this.targetDirection);
            
            // Verificar si realmente se movió comparando posiciones
            const positionAfter = this.actions.position();
            
            if (this.positionsEqual(positionBefore, positionAfter)) {
                console.log('Movement failed - position unchanged, checking obstacles...');
                this.currentState = NavigationStateMachine.STATES.CHECKING_OBSTACLES;
            } else {
                console.log(`Successfully moved ${this.targetDirection} from (${positionBefore.x}, ${positionBefore.y}, ${positionBefore.z}) to (${positionAfter.x}, ${positionAfter.y}, ${positionAfter.z})`);
                this.lastPosition = positionAfter;
                // Continuar moviéndose sin sleep largo
                await this.sleep(100);
            }
        } catch (error) {
            console.log(`Movement blocked, analyzing obstacle...`);
            this.currentState = NavigationStateMachine.STATES.CHECKING_OBSTACLES;
        }
    }

    // Verificar si dos posiciones son iguales
    positionsEqual(pos1, pos2) {
        return pos1.x === pos2.x && pos1.y === pos2.y && pos1.z === pos2.z;
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
        
        // Lógica de decisión según tu especificación
        if (headBlocked) {
            // Si la cabeza está bloqueada, cambiar dirección inmediatamente
            console.log('Head blocked - changing direction');
            this.currentState = NavigationStateMachine.STATES.CHANGING_DIRECTION;
        } else if (feetBlocked && !headBlocked) {
            // Si solo los pies están bloqueados, intentar saltar
            console.log('Only feet blocked - attempting to jump');
            this.currentState = NavigationStateMachine.STATES.JUMPING;
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
            'potatoes', 'beetroots', 'sugar_cane', 'kelp', 'seagrass'
        ];
        
        return !nonSolidBlocks.includes(block.name);
    }

    // Manejar estado JUMPING
    async handleJumping() {
        console.log('Executing jump sequence...');
        
        const positionBefore = this.actions.position();
        
        try {
            // Saltar y intentar moverse inmediatamente sin sleep largo
            this.actions.jump();
            await this.sleep(200); // Tiempo mínimo para que inicie el salto
            
            // Intentar moverse mientras está saltando
            await this.actions.step(this.targetDirection);
            
            // Verificar si se movió
            const positionAfter = this.actions.position();
            
            if (this.positionsEqual(positionBefore, positionAfter)) {
                console.log('Jump sequence failed - changing direction');
                this.currentState = NavigationStateMachine.STATES.CHANGING_DIRECTION;
            } else {
                console.log('Jump and move sequence completed successfully');
                this.lastPosition = positionAfter;
                this.currentState = NavigationStateMachine.STATES.MOVING;
            }
            
        } catch (error) {
            console.log('Jump sequence failed - changing direction');
            this.currentState = NavigationStateMachine.STATES.CHANGING_DIRECTION;
        }
    }

    // Manejar estado CHANGING_DIRECTION
    async handleChangingDirection() {
        console.log('Executing direction change...');
        
        // Cambiar a la siguiente dirección en el orden: north -> east -> south -> west -> north...
        this.currentDirectionIndex = (this.currentDirectionIndex + 1) % this.directions.length;
        this.targetDirection = this.directions[this.currentDirectionIndex];
        
        console.log(`Direction changed to: ${this.targetDirection}`);
        
        // Orientar el bot hacia la nueva dirección SOLO cuando cambia de dirección
        const directionOffset = this.getDirectionOffset(this.targetDirection);
        await this.actions.look(directionOffset.yaw, 0);
        
        // Volver al estado de movimiento sin delay largo
        this.currentState = NavigationStateMachine.STATES.MOVING;
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
            position: this.actions.position()
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