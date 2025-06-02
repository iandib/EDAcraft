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

#include "fsm.h"
#include <iostream>

// Constructor: set initial state and origin
FSM::FSM() : state(State::RequestPosition), originX(0), originY(0), originZ(0), 
             currentX(0), currentY(0), currentZ(0), targetDirection("east"),
             digX(0), digY(0), digZ(0), stepCount(0) {}

// Generate the next action command based on the current FSM state
nlohmann::json FSM::nextAction()
{
    nlohmann::json action;
    
    switch (state) {
        case State::RequestPosition:
            action["action"] = "position";
            std::cerr << "Requesting bot position..." << std::endl;
            return action;
            
        case State::MoveToTarget:
            // Limitar el número de pasos para evitar bucles infinitos
            if (stepCount >= 50) {
                std::cerr << "Maximum steps reached, going idle..." << std::endl;
                state = State::Done;
                return nlohmann::json{};
            }
            
            action["action"] = "step";
            action["dir"] = targetDirection;
            std::cerr << "Sending step " << targetDirection << " (step " << stepCount + 1 << ")..." << std::endl;
            return action;
            
        case State::CheckBlockAhead:
            // Calcular la posición del bloque que está adelante según la dirección
            if (targetDirection == "east") {
                digX = currentX + 1;
                digY = currentY;
                digZ = currentZ;
            } else if (targetDirection == "west") {
                digX = currentX - 1;
                digY = currentY;
                digZ = currentZ;
            } else if (targetDirection == "north") {
                digX = currentX;
                digY = currentY;
                digZ = currentZ - 1;
            } else if (targetDirection == "south") {
                digX = currentX;
                digY = currentY;
                digZ = currentZ + 1;
            }
            
            action["action"] = "block_at";
            action["position"]["x"] = digX;
            action["position"]["y"] = digY;
            action["position"]["z"] = digZ;
            std::cerr << "Checking block at (" << digX << ", " << digY << ", " << digZ << ")..." << std::endl;
            return action;
            
        case State::DigBlockAhead:
            action["action"] = "dig_block";
            action["x"] = digX;
            action["y"] = digY;
            action["z"] = digZ;
            std::cerr << "Digging block at (" << digX << ", " << digY << ", " << digZ << ")..." << std::endl;
            return action;
            
        case State::Idle:
            std::cerr << "Bot is idle, waiting..." << std::endl;
            return nlohmann::json{}; // Retorna JSON vacío
            
        case State::Done:
            std::cerr << "Task completed! Bot moved " << stepCount << " steps." << std::endl;
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
            // Si recibimos la posición correctamente, guardamos las coordenadas y cambiamos a MoveToTarget
            if ((msg.contains("status") && msg["status"] == "ok") || 
                (msg.contains("type") && msg["type"] == "position")) {
                
                if (msg.contains("x") && msg.contains("y") && msg.contains("z")) {
                    currentX = msg["x"];
                    currentY = msg["y"];
                    currentZ = msg["z"];
                    std::cerr << "Position received: (" << currentX << ", " << currentY << ", " << currentZ << ")" << std::endl;
                }
                
                std::cerr << "Starting movement..." << std::endl;
                state = State::MoveToTarget;
            }
            break;
            
        case State::MoveToTarget:
            // Si el paso fue exitoso, seguimos moviéndonos
            if (msg.contains("action") && msg["action"] == "step") {
                // Manejar tanto boolean como string para "ok"
                bool stepSuccessful = false;
                if (msg.contains("ok")) {
                    if (msg["ok"].is_boolean()) {
                        stepSuccessful = msg["ok"].get<bool>();
                    } else if (msg["ok"].is_string()) {
                        stepSuccessful = (msg["ok"] == "true");
                    }
                }
                
                if (stepSuccessful) {
                    std::cerr << "Step successful, continuing movement..." << std::endl;
                    stepCount++;
                    
                    // Actualizar posición actual basada en la dirección del movimiento
                    if (targetDirection == "east") {
                        currentX++;
                    } else if (targetDirection == "west") {
                        currentX--;
                    } else if (targetDirection == "north") {
                        currentZ--;
                    } else if (targetDirection == "south") {
                        currentZ++;
                    }
                    
                    // Mantenemos el estado MoveToTarget para seguir moviéndonos
                } else {
                    std::cerr << "Step failed: " << msg.dump() << std::endl;
                    // Si falla el movimiento, vamos a ver qué bloque está bloqueando
                    state = State::CheckBlockAhead;
                }
            }
            break;
            
        case State::CheckBlockAhead:
            // Analizamos qué bloque está en la posición bloqueante
            if ((msg.contains("action") && msg["action"] == "block_at") ||
                (msg.contains("type") && msg["type"] == "block_at")) {
                
                if (msg.contains("name")) {
                    std::string blockName = msg["name"];
                    std::cerr << "Found blocking block: " << blockName << std::endl;
                    
                    // Si hay un bloque que podemos romper (como hojas, madera, tierra, etc.)
                    if (blockName != "air" && blockName != "water" && blockName != "lava" && 
                        blockName != "bedrock" && blockName != "barrier") {
                        std::cerr << "Attempting to dig through " << blockName << std::endl;
                        state = State::DigBlockAhead;
                    } else {
                        std::cerr << "Cannot dig " << blockName << ", changing direction..." << std::endl;
                        changeDirection();
                    }
                } else if (msg.contains("message")) {
                    std::cerr << "No block found at target position: " << msg["message"] << std::endl;
                    // Si no hay bloque (es aire), significa que el pathfinder falló por otra razón
                    // Intentamos cambiar de dirección
                    changeDirection();
                } else {
                    std::cerr << "Unexpected block_at response, changing direction..." << std::endl;
                    changeDirection();
                }
            }
            break;
            
        case State::DigBlockAhead:
            // Procesamos el resultado del intento de minado
            if (msg.contains("action") && msg["action"] == "dig_block") {
                // Manejar tanto boolean como string para "ok"
                bool digSuccessful = false;
                if (msg.contains("ok")) {
                    if (msg["ok"].is_boolean()) {
                        digSuccessful = msg["ok"].get<bool>();
                    } else if (msg["ok"].is_string()) {
                        digSuccessful = (msg["ok"] == "true");
                    }
                }
                
                if (digSuccessful) {
                    std::cerr << "Successfully dug block, trying to move again..." << std::endl;
                    state = State::MoveToTarget;
                } else {
                    std::cerr << "Failed to dig block: " << msg.dump() << std::endl;
                    // Si no podemos picar, cambiamos de dirección
                    changeDirection();
                }
            }
            break;
            
        default:
            break;
    }
}

// Función auxiliar para cambiar de dirección
void FSM::changeDirection() {
    if (targetDirection == "east") {
        targetDirection = "south";
        std::cerr << "Changing direction to south" << std::endl;
        state = State::MoveToTarget;
    } else if (targetDirection == "south") {
        targetDirection = "west";
        std::cerr << "Changing direction to west" << std::endl;
        state = State::MoveToTarget;
    } else if (targetDirection == "west") {
        targetDirection = "north";
        std::cerr << "Changing direction to north" << std::endl;
        state = State::MoveToTarget;
    } else if (targetDirection == "north") {
        targetDirection = "east";
        std::cerr << "Changing direction to east" << std::endl;
        state = State::MoveToTarget;
    } else {
        std::cerr << "All directions tried, going idle" << std::endl;
        state = State::Idle;
    }
}

// Optionally update the bot's origin position
void FSM::setOrigin(int x, int y, int z) {
    originX = x;
    originY = y;
    originZ = z;
}