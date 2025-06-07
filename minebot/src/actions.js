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

        // Mirar en la dirección del movimiento
        await this.look(offset.yaw, 0);

        // Usar pathfinder para moverse un bloque
        const goal = new GoalBlock(targetPos.x, targetPos.y, targetPos.z);
        await this.bot.pathfinder.goto(goal);
        
        console.log(`Bot stepped ${direction} to position: ${targetPos.x}, ${targetPos.y}, ${targetPos.z}`);
        return true;
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