const { GoalBlock } = require('mineflayer-pathfinder').goals;
const { Vec3 } = require("vec3");

class BotActions {
    constructor(bot) {
        this.bot = bot;
        this.chestWindow = null;
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

        // Buscar el nivel Y correcto (permite saltar 1 bloque o caer hasta 6)
        const MAX_JUMP = 1;
        const MAX_FALL = 6;
        
        let validTarget = null;
        
        for (let dy = MAX_JUMP; dy >= -MAX_FALL; dy--) {
            const testPos = targetPos.offset(0, dy, 0);
            const blockBelow = this.bot.blockAt(testPos.offset(0, -1, 0));
            const blockAt = this.bot.blockAt(testPos);
            const blockAbove = this.bot.blockAt(testPos.offset(0, 1, 0));

            const solidBelow = blockBelow && blockBelow.boundingBox === 'block';
            const spaceAt = !blockAt || blockAt.boundingBox === 'empty';
            const spaceAbove = !blockAbove || blockAbove.boundingBox === 'empty';

            if (solidBelow && spaceAt && spaceAbove) {
                validTarget = testPos;
                break;
            }
        }

        if (!validTarget) {
            throw new Error('No se puede mover en esa dirección (bloqueado o muy alto/profundo)');
        }

        // Mirar en la dirección del movimiento
        await this.bot.look(offset.yaw, 0, true);

        // Usar pathfinder para moverse
        const goal = new GoalBlock(validTarget.x, validTarget.y, validTarget.z);
        await this.bot.pathfinder.goto(goal);
        
        console.log(`Bot moved ${direction} to position: ${validTarget.x}, ${validTarget.y}, ${validTarget.z}`);
        return true;
    }

    // Mirar en una dirección específica
    async look(yaw, pitch = 0) {
        await this.bot.look(yaw, pitch, true);
        console.log(`Bot looked to yaw: ${yaw}, pitch: ${pitch}`);
    }

    // Escribir en el chat
    chat(message) {
        this.bot.chat(message);
        console.log(`Bot said: ${message}`);
    }

    // Saltar
    jump() {
        this.bot.setControlState('jump', true);
        setTimeout(() => {
            this.bot.setControlState('jump', false);
        }, 500);
        console.log('Bot jumped');
    }

    // Obtener posición actual
    getPosition() {
        const pos = this.bot.entity.position;
        return {
            x: Math.floor(pos.x),
            y: Math.floor(pos.y),
            z: Math.floor(pos.z)
        };
    }

    // Obtener inventario
    getInventory() {
        return this.bot.inventory.items().map(item => ({
            name: item.name,
            count: item.count,
            slot: item.slot
        }));
    }

    // Obtener información vital (salud, hambre)
    getVitals() {
        return {
            health: this.bot.health,
            food: this.bot.food,
            oxygen: this.bot.oxygenLevel
        };
    }

    // Equipar item
    async equip(itemName, destination = 'hand') {
        const item = this.bot.inventory.items().find(i => i.name === itemName);
        if (!item) {
            throw new Error(`Item '${itemName}' no encontrado en el inventario`);
        }
        
        await this.bot.equip(item, destination);
        console.log(`Equipped ${itemName} in ${destination}`);
        return true;
    }

    // Cavar bloque
    async digBlock(x, y, z) {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) {
            throw new Error('No hay bloque en esa posición');
        }
        if (!this.bot.canDigBlock(block)) {
            throw new Error('No se puede cavar este bloque');
        }

        await this.bot.dig(block);
        console.log(`Dug block ${block.name} at ${x}, ${y}, ${z}`);
        return true;
    }

    // Colocar bloque
    async placeBlock(itemName, x, y, z, face = new Vec3(0, 1, 0)) {
        const referenceBlock = this.bot.blockAt(new Vec3(x, y, z));
        if (!referenceBlock) {
            throw new Error('Bloque de referencia no encontrado');
        }

        const item = this.bot.inventory.items().find(i => i.name === itemName);
        if (!item) {
            throw new Error(`Item '${itemName}' no encontrado en el inventario`);
        }

        await this.bot.equip(item, 'hand');
        await this.bot.placeBlock(referenceBlock, face);
        console.log(`Placed ${itemName} at ${x}, ${y + 1}, ${z}`);
        return true;
    }
}

module.exports = BotActions;