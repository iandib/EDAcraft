const { GoalBlock } = require('mineflayer-pathfinder').goals;
const { Vec3 } = require("vec3");

class BotActions {
    constructor(bot) {
        this.bot = bot;
    }

    // Método para hacer un paso en una dirección cardinal
    async step(direction) {
        const directions = {
            north: { x: 0, z: -1, yaw: Math.PI },
            south: { x: 0, z: 1, yaw: 0 },
            west: { x: -1, z: 0, yaw: Math.PI / 2 },
            east: { x: 1, z: 0, yaw: -Math.PI / 2 }
        };

        if (!directions[direction]) {
            throw new Error(`Dirección inválida: ${direction}`);
        }

        const offset = directions[direction];
        const currentPos = this.bot.entity.position.floored();
        const targetPos = currentPos.offset(offset.x, 0, offset.z);

        // NO cambiar la dirección de vista aquí si ya está configurada
        // Esto evita interrumpir movimientos en progreso
        
        console.log(`Attempting to move from (${currentPos.x}, ${currentPos.y}, ${currentPos.z}) to (${targetPos.x}, ${targetPos.y}, ${targetPos.z})`);

        try {
            // Usar pathfinder para moverse un bloque
            const goal = new GoalBlock(targetPos.x, targetPos.y, targetPos.z);
            
            // Esperar a que el movimiento se complete completamente
            await this.bot.pathfinder.goto(goal);
            
            // Verificar posición final después del movimiento
            const finalPos = this.bot.entity.position.floored();
            const moved = !(currentPos.x === finalPos.x && currentPos.y === finalPos.y && currentPos.z === finalPos.z);
            
            if (moved) {
                console.log(`Bot successfully stepped ${direction} to position: ${finalPos.x}, ${finalPos.y}, ${finalPos.z}`);
            } else {
                console.log(`Bot failed to move ${direction}, still at: ${finalPos.x}, ${finalPos.y}, ${finalPos.z}`);
            }
            
            return moved;
        } catch (error) {
            console.log(`Movement failed: ${error.message}`);
            return false;
        }
    }

    // Mirar en una dirección específica
    async look(yaw, pitch = 0) {
        await this.bot.look(yaw, pitch, true);
        console.log(`Bot looked to yaw: ${yaw}, pitch: ${pitch}`);
        return true;
    }

    // Saltar
    jump() {
        this.bot.setControlState('jump', true);
        setTimeout(() => {
            this.bot.setControlState('jump', false);
        }, 500);
        console.log('Bot jumped');
        return true;
    }

    // Obtener posición actual
    position() {
        const pos = this.bot.entity.position;
        return {
            x: Math.floor(pos.x),
            y: Math.floor(pos.y),
            z: Math.floor(pos.z)
        };
    }



    // Encontrar el bloque más cercano de un tipo específico
    find_block(blockType, maxDistance = 16) {
        const block = this.bot.findBlock({
            matching: (block) => block.name === blockType,
            maxDistance: maxDistance
        });
        
        if (block) {
            return {
                x: block.position.x,
                y: block.position.y,
                z: block.position.z,
                name: block.name
            };
        }
        return null;
    }

    // Obtener información del bloque en una posición específica
    block_at(x, y, z) {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (block) {
            return {
                name: block.name,
                type: block.type,
                position: { x, y, z },
                boundingBox: block.boundingBox
            };
        }
        return null;
    }
}

module.exports = BotActions;