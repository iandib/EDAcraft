/**
 * @brief FSM that handles bot behaviour
 *
 * @author Agustín Galdeman
 * @author
 * @author
 *
 * @copyright Copyright (c) 2025
 *
 */

// TODO 1 hay q corregir el A* para q funcione en 3D y no se bugee en la copa del árbol
// TODO 2 hay q ponerle q actualice el path a medida que ve objetos
// TODO 3 ver pq se congela cuando salta hacia abajo
// TODO 4 hacer q reconozca el tipo de bloques, si ve q está trabado q intente picar

#include "fsm.h"
#include "json_helpers.h"
#include <iostream>
#include <cmath>

// Constructor: set initial state and initialize pathfinder
FSM::FSM() : state(State::RequestPosition), originX(0), originY(0), originZ(0), 
             currentX(0), currentY(0), currentZ(0), 
             targetPos(TARGET_X, TARGET_Y, TARGET_Z),
             digX(0), digY(0), digZ(0), stepCount(0),
             explorationDirection("east"), explorationSteps(0), maxExplorationSteps(10),
             pathCalculated(false), positionReceived(false), recalculationAttempts(0) {}

// Generate the next action command based on the current FSM state
nlohmann::json FSM::nextAction()
{
    nlohmann::json action;
    
    switch (state) {
        case State::RequestPosition:
            action = createPositionCommand();
            std::cerr << "Requesting bot position..." << std::endl;
            return action;
            
        case State::CalculatePath:
            {
                Position3D startPos(currentX, currentY, currentZ);
                std::cerr << "Calculating path from (" << currentX << ", " << currentY << ", " << currentZ 
                         << ") to (" << TARGET_X << ", " << TARGET_Y << ", " << TARGET_Z << ")..." << std::endl;
                
                if (pathfinder.calculatePath(startPos, targetPos)) {
                    std::cerr << "Path calculated successfully!" << std::endl;
                    pathCalculated = true;
                    state = State::MoveToNextPosition;
                } else {
                    std::cerr << "Failed to calculate path!" << std::endl;
                    state = State::Idle;
                }
                return nlohmann::json{};
            }
            
        case State::MoveToNextPosition:
            if (isAtTarget()) {
                std::cerr << "Reached target coordinates!" << std::endl;
                state = State::Done;
                return nlohmann::json{};
            }
            
            if (pathfinder.isPathComplete()) {
                std::cerr << "Path complete but not at target, recalculating..." << std::endl;
                state = State::RecalculatePath;
                return nlohmann::json{};
            }
            
            // Get next position from pathfinder
            nextPos = pathfinder.getNextPosition(Position3D(currentX, currentY, currentZ));
            currentDirection = calculateDirection(Position3D(currentX, currentY, currentZ), nextPos);
            
            if (currentDirection.empty()) {
                std::cerr << "No valid direction found, recalculating path..." << std::endl;
                state = State::RecalculatePath;
                return nlohmann::json{};
            }
            
            // If we need to jump
            if (nextPos.y > currentY) {
                action = createJumpCommand();
                std::cerr << "Jumping to reach higher position..." << std::endl;
                return action;
            }
            
            action = createStepCommand(currentDirection);
            std::cerr << "Moving " << currentDirection << " towards (" << nextPos.x << ", " << nextPos.y << ", " << nextPos.z << ")..." << std::endl;
            return action;
            
        case State::CheckBlockAhead:
            action = createBlockAtCommand(digX, digY, digZ);
            std::cerr << "Checking block at (" << digX << ", " << digY << ", " << digZ << ")..." << std::endl;
            return action;
            
        case State::DigBlockAhead:
            action["action"] = "dig_block";
            action["x"] = digX;
            action["y"] = digY;
            action["z"] = digZ;
            std::cerr << "Digging block at (" << digX << ", " << digY << ", " << digZ << ")..." << std::endl;
            return action;
            
        case State::RecalculatePath:
            if (recalculationAttempts >= 3) {
                std::cerr << "Too many recalculation attempts, starting exploration mode..." << std::endl;
                state = State::ExploreRandomly;
                explorationSteps = 0;
                explorationDirection = "east"; // Reset exploration direction
                return nlohmann::json{};
            }
            
            recalculationAttempts++;
            pathfinder.reset();
            state = State::CalculatePath;
            std::cerr << "Recalculating path (attempt " << recalculationAttempts << ")..." << std::endl;
            return nlohmann::json{};
            
        case State::ExploreRandomly:
            if (explorationSteps >= maxExplorationSteps) {
                std::cerr << "Exploration complete, trying to calculate path again..." << std::endl;
                recalculationAttempts = 0; // Reset recalculation attempts
                state = State::CalculatePath;
                return nlohmann::json{};
            }
            
            action = createStepCommand(explorationDirection);
            std::cerr << "Exploring: moving " << explorationDirection << " (step " << explorationSteps + 1 << "/" << maxExplorationSteps << ")..." << std::endl;
            return action;
            
        case State::Idle:
            std::cerr << "Bot is idle, waiting..." << std::endl;
            return nlohmann::json{};
            
        case State::Done:
            std::cerr << "Task completed! Bot reached target coordinates after " << stepCount << " steps." << std::endl;
            return nlohmann::json{};
            
        default:
            return nlohmann::json{};
    }
}

// Process the bot's reply to transition FSM state
void FSM::handleBotFeedback(const nlohmann::json& msg)
{
    if (!msg.contains("action") && !msg.contains("status") && !msg.contains("type")) {
        return;
    }

    switch (state) {
        case State::RequestPosition:
            {
                int x, y, z;
                if (extractPosition(msg, x, y, z)) {
                    currentX = x;
                    currentY = y;
                    currentZ = z;
                    positionReceived = true;
                    std::cerr << "Position received: (" << currentX << ", " << currentY << ", " << currentZ << ")" << std::endl;
                    
                    if (isAtTarget()) {
                        std::cerr << "Already at target coordinates!" << std::endl;
                        state = State::Done;
                    } else {
                        state = State::CalculatePath;
                    }
                }
            }
            break;
            
        case State::MoveToNextPosition:
            if (msg.contains("action") && msg["action"] == "step") {
                if (isSuccessResponse(msg)) {
                    std::cerr << "Step successful!" << std::endl;
                    stepCount++;
                    
                    // Update current position
                    currentX = nextPos.x;
                    currentY = nextPos.y;
                    currentZ = nextPos.z;
                    
                    std::cerr << "Current position: (" << currentX << ", " << currentY << ", " << currentZ << ")" << std::endl;
                    
                    // Continue moving
                    // State remains MoveToNextPosition for next iteration
                } else {
                    std::cerr << "Step failed: " << msg.dump() << std::endl;
                    
                    // Calculate position of blocking block
                    if (currentDirection == "east") {
                        digX = currentX + 1; digY = currentY; digZ = currentZ;
                    } else if (currentDirection == "west") {
                        digX = currentX - 1; digY = currentY; digZ = currentZ;
                    } else if (currentDirection == "north") {
                        digX = currentX; digY = currentY; digZ = currentZ - 1;
                    } else if (currentDirection == "south") {
                        digX = currentX; digY = currentY; digZ = currentZ + 1;
                    }
                    
                    state = State::CheckBlockAhead;
                }
            } else if (msg.contains("action") && msg["action"] == "jump") {
                std::cerr << "Jump executed, continuing movement..." << std::endl;
                // Continue with step command next
            }
            break;
            
        case State::CheckBlockAhead:
            if ((msg.contains("action") && msg["action"] == "block_at") ||
                (msg.contains("type") && msg["type"] == "block_at")) {
                
                std::string blockName;
                if (extractBlockInfo(msg, blockName)) {
                    std::cerr << "Found blocking block: " << blockName << std::endl;
                    
                    // Update world cache
                    updateWorldCache(Position3D(digX, digY, digZ), blockName);
                    
                    // Special case: if we're trying to dig air, we're probably stuck in tree canopy
                    if (blockName == "air") {
                        std::cerr << "Cannot dig air - bot appears to be stuck in tree canopy or similar. Starting exploration mode..." << std::endl;
                        state = State::ExploreRandomly;
                        explorationSteps = 0;
                        explorationDirection = "east"; // Reset exploration direction
                        return;
                    }
                    
                    if (blockName != "water" && blockName != "lava" && 
                        blockName != "bedrock" && blockName != "barrier") {
                        std::cerr << "Attempting to dig through " << blockName << std::endl;
                        state = State::DigBlockAhead;
                    } else {
                        std::cerr << "Cannot dig " << blockName << ", recalculating path..." << std::endl;
                        state = State::RecalculatePath;
                    }
                } else {
                    std::cerr << "Could not identify blocking block, recalculating path..." << std::endl;
                    state = State::RecalculatePath;
                }
            }
            break;
            
        case State::DigBlockAhead:
            if (msg.contains("action") && msg["action"] == "dig_block") {
                if (isSuccessResponse(msg)) {
                    std::cerr << "Successfully dug block, updating world cache and continuing..." << std::endl;
                    
                    // Update world cache to mark block as air
                    updateWorldCache(Position3D(digX, digY, digZ), "air");
                    
                    state = State::MoveToNextPosition;
                } else {
                    std::cerr << "Failed to dig block: " << msg.dump() << std::endl;
                    state = State::RecalculatePath;
                }
            }
            break;
            
        case State::ExploreRandomly:
            if (msg.contains("action") && msg["action"] == "step") {
                if (isSuccessResponse(msg)) {
                    std::cerr << "Exploration step successful!" << std::endl;
                    explorationSteps++;
                    
                    // Update current position based on exploration direction
                    if (explorationDirection == "east") {
                        currentX++;
                    } else if (explorationDirection == "west") {
                        currentX--;
                    } else if (explorationDirection == "north") {
                        currentZ--;
                    } else if (explorationDirection == "south") {
                        currentZ++;
                    }
                    
                    std::cerr << "Current position: (" << currentX << ", " << currentY << ", " << currentZ << ")" << std::endl;
                    
                    // Check if we've reached the target during exploration
                    if (isAtTarget()) {
                        std::cerr << "Reached target during exploration!" << std::endl;
                        state = State::Done;
                    }
                    // Continue exploration or finish based on step count
                } else {
                    std::cerr << "Exploration step failed, changing direction..." << std::endl;
                    changeExplorationDirection();
                }
            }
            break;
            
        default:
            break;
    }
}

// Helper function to calculate direction string from two positions
std::string FSM::calculateDirection(const Position3D& from, const Position3D& to) {
    int dx = to.x - from.x;
    int dz = to.z - from.z;
    
    // Only handle cardinal directions for step command
    if (dx > 0 && dz == 0) return "east";
    if (dx < 0 && dz == 0) return "west";
    if (dz < 0 && dx == 0) return "north";
    if (dz > 0 && dx == 0) return "south";
    
    // For diagonal or complex movements, prioritize X movement
    if (dx > 0) return "east";
    if (dx < 0) return "west";
    if (dz < 0) return "north";
    if (dz > 0) return "south";
    
    return ""; // No movement needed
}

// Helper function to change exploration direction when blocked
void FSM::changeExplorationDirection() {
    if (explorationDirection == "east") {
        explorationDirection = "south";
        std::cerr << "Changing exploration direction to south" << std::endl;
    } else if (explorationDirection == "south") {
        explorationDirection = "west";
        std::cerr << "Changing exploration direction to west" << std::endl;
    } else if (explorationDirection == "west") {
        explorationDirection = "north";
        std::cerr << "Changing exploration direction to north" << std::endl;
    } else if (explorationDirection == "north") {
        explorationDirection = "east";
        std::cerr << "Changing exploration direction to east" << std::endl;
    }
}

// Check if bot is at target coordinates
bool FSM::isAtTarget() const {
    return abs(currentX - TARGET_X) <= 1 && 
           abs(currentY - TARGET_Y) <= 1 && 
           abs(currentZ - TARGET_Z) <= 1;
}

// Update world cache with block information
void FSM::updateWorldCache(const Position3D& pos, const std::string& blockName) {
    BlockType blockType;
    
    if (blockName == "air") {
        blockType = BlockType::AIR;
    } else if (blockName == "water" || blockName == "lava") {
        blockType = BlockType::LIQUID;
    } else {
        blockType = BlockType::SOLID;
    }
    
    pathfinder.updateWorldCache(pos, blockType);
}

// Legacy function - kept for compatibility but not used in A* implementation
void FSM::changeDirection() {
    // This function is not needed in A* implementation
    // The pathfinder handles direction changes automatically
}

// Optionally update the bot's origin position
void FSM::setOrigin(int x, int y, int z) {
    originX = x;
    originY = y;
    originZ = z;
}