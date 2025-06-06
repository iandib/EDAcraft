class BotBehaviors {
    constructor(bot, actions) {
        this.bot = bot;
        this.actions = actions;
        this.currentBehavior = null;
        this.isRunning = false;
    }

    // Comportamiento simple: mover en línea recta
    async moveStraight(direction, steps) {
        console.log(`Starting straight movement: ${direction} for ${steps} steps`);
        
        this.currentBehavior = 'moveStraight';
        this.isRunning = true;
        
        try {
            for (let i = 0; i < steps && this.isRunning; i++) {
                console.log(`Step ${i + 1}/${steps}`);
                await this.actions.step(direction);
                
                // Pausa pequeña entre pasos para que se vea más natural
                await this.sleep(500);
            }
            
            console.log('Straight movement completed');
        } catch (error) {
            console.error('Error during straight movement:', error.message);
            throw error;
        } finally {
            this.isRunning = false;
            this.currentBehavior = null;
        }
    }

    // Comportamiento: mover en cuadrado
    async moveInSquare(size = 4) {
        console.log(`Starting square movement with size ${size}`);
        
        this.currentBehavior = 'moveInSquare';
        this.isRunning = true;
        
        const directions = ['north', 'east', 'south', 'west'];
        
        try {
            for (let side = 0; side < 4 && this.isRunning; side++) {
                const direction = directions[side];
                console.log(`Moving ${direction} for ${size} steps`);
                
                for (let step = 0; step < size && this.isRunning; step++) {
                    await this.actions.step(direction);
                    await this.sleep(300);
                }
            }
            
            console.log('Square movement completed');
        } catch (error) {
            console.error('Error during square movement:', error.message);
            throw error;
        } finally {
            this.isRunning = false;
            this.currentBehavior = null;
        }
    }

    // Comportamiento: exploración simple (movimiento aleatorio)
    async explore(duration = 30000) { // 30 segundos por defecto
        console.log(`Starting exploration for ${duration/1000} seconds`);
        
        this.currentBehavior = 'explore';
        this.isRunning = true;
        
        const directions = ['north', 'south', 'east', 'west'];
        const startTime = Date.now();
        
        try {
            while (Date.now() - startTime < duration && this.isRunning) {
                const randomDirection = directions[Math.floor(Math.random() * directions.length)];
                const randomSteps = Math.floor(Math.random() * 3) + 1; // 1-3 pasos
                
                console.log(`Exploring: ${randomDirection} for ${randomSteps} steps`);
                
                try {
                    for (let i = 0; i < randomSteps && this.isRunning; i++) {
                        await this.actions.step(randomDirection);
                        await this.sleep(400);
                    }
                } catch (error) {
                    console.log(`Blocked in ${randomDirection}, trying another direction`);
                    // Si no puede moverse en esa dirección, prueba otra
                    continue;
                }
                
                // Pausa entre cambios de dirección
                await this.sleep(800);
            }
            
            console.log('Exploration completed');
        } catch (error) {
            console.error('Error during exploration:', error.message);
            throw error;
        } finally {
            this.isRunning = false;
            this.currentBehavior = null;
        }
    }

    // Detener comportamiento actual
    stop() {
        console.log('Stopping current behavior');
        this.isRunning = false;
    }

    // Obtener estado actual
    getStatus() {
        return {
            currentBehavior: this.currentBehavior,
            isRunning: this.isRunning,
            position: this.actions.getPosition(),
            vitals: this.actions.getVitals()
        };
    }

    // Utilidad para pausas
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Comportamiento reactivo: huir si recibe daño
    setupDefensiveBehavior() {
        let lastHealth = this.bot.health;
        
        this.bot.on('health', () => {
            if (this.bot.health < lastHealth) {
                console.log('Taking damage! Attempting to flee...');
                this.stop(); // Detener comportamiento actual
                
                // Mover aleatoriamente para escapar
                this.quickEscape();
            }
            lastHealth = this.bot.health;
        });
    }

    // Escape rápido
    async quickEscape() {
        const directions = ['north', 'south', 'east', 'west'];
        
        for (let i = 0; i < 3; i++) {
            try {
                const randomDirection = directions[Math.floor(Math.random() * directions.length)];
                await this.actions.step(randomDirection);
                await this.sleep(200);
            } catch (error) {
                // Si no puede moverse, intenta saltar
                this.actions.jump();
                await this.sleep(300);
            }
        }
    }
}

module.exports = BotBehaviors;