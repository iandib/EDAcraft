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
             checkX(0), checkY(0), checkZ(0), stepCount(0),
             preStepX(0), preStepY(0), preStepZ(0),
             scanX(0), scanY(0), scanZ(0), scanStartX(0), scanStartY(0), scanStartZ(0),
             scanEndX(0), scanEndY(0), scanEndZ(0), scanningActive(false) {}

// Generate the next action command based on the current FSM state
nlohmann::json FSM::nextAction()
{
    nlohmann::json action;
    
    switch (state) {
        case State::RequestPosition:
            action["action"] = "position";
            std::cerr << "Requesting bot position..." << std::endl;
            return action;
            
        case State::RequestCurrentPosition:
            action["action"] = "position";
            std::cerr << "Requesting updated bot position..." << std::endl;
            return action;
            
        case State::MoveToTarget:
            // Limitar el número de pasos para evitar bucles infinitos
            if (stepCount >= 100) {
                std::cerr << "Maximum steps reached, going idle..." << std::endl;
                state = State::Done;
                return nlohmann::json{};
            }
            
            // Guardar posición antes del step para calcular correctamente el bloque bloqueante
            preStepX = currentX;
            preStepY = currentY;
            preStepZ = currentZ;
            
            action["action"] = "step";
            action["dir"] = targetDirection;
            std::cerr << "Sending step " << targetDirection << " (step " << stepCount + 1 << ")..." << std::endl;
            return action;
            
        case State::ScanForBlocks:
            // Si acabamos de empezar el escaneo, configurar los límites
            if (!scanningActive) {
                scanStartX = currentX - 3;
                scanStartY = currentY - 3;
                scanStartZ = currentZ - 3;
                scanEndX = currentX + 3;
                scanEndY = currentY + 3;
                scanEndZ = currentZ + 3;
                
                scanX = scanStartX;
                scanY = scanStartY;
                scanZ = scanStartZ;
                scanningActive = true;
                
                std::cerr << "Starting block scan in 2x2x2 area around bot at (" << currentX << ", " << currentY << ", " << currentZ << ")" << std::endl;
                std::cerr << "Scan range: X[" << scanStartX << " to " << scanEndX << "], Y[" << scanStartY << " to " << scanEndY << "], Z[" << scanStartZ << " to " << scanEndZ << "]" << std::endl;
            }
            
            // Escanear la posición actual
            action["action"] = "block_at";
            action["position"]["x"] = scanX;
            action["position"]["y"] = scanY;
            action["position"]["z"] = scanZ;
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
                
                if (msg.contains("position")) {
                    currentX = msg["position"]["x"];
                    currentY = msg["position"]["y"];
                    currentZ = msg["position"]["z"];
                } else if (msg.contains("x") && msg.contains("y") && msg.contains("z")) {
                    currentX = msg["x"];
                    currentY = msg["y"];
                    currentZ = msg["z"];
                }
                
                std::cerr << "Position received: (" << currentX << ", " << currentY << ", " << currentZ << ")" << std::endl;
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
                    
                    std::cerr << "New position: (" << currentX << ", " << currentY << ", " << currentZ << ")" << std::endl;
                    
                    // Mantenemos el estado MoveToTarget para seguir moviéndonos
                } else {
                    std::cerr << "Step failed: " << msg.dump() << std::endl;
                    // IMPORTANTE: Solicitar la posición actual real del bot antes de hacer el escaneo
                    std::cerr << "Requesting current position after failed step..." << std::endl;
                    state = State::RequestCurrentPosition;
                }
            }
            break;
            
        case State::RequestCurrentPosition:
            // Actualizar la posición actual después de un step fallido
            if ((msg.contains("status") && msg["status"] == "ok") || 
                (msg.contains("type") && msg["type"] == "position")) {
                
                if (msg.contains("position")) {
                    currentX = msg["position"]["x"];
                    currentY = msg["position"]["y"];
                    currentZ = msg["position"]["z"];
                } else if (msg.contains("x") && msg.contains("y") && msg.contains("z")) {
                    currentX = msg["x"];
                    currentY = msg["y"];
                    currentZ = msg["z"];
                }
                
                std::cerr << "Updated position after failed step: (" << currentX << ", " << currentY << ", " << currentZ << ")" << std::endl;
                std::cerr << "Pre-step position was: (" << preStepX << ", " << preStepY << ", " << preStepZ << ")" << std::endl;
                // Ahora iniciamos el escaneo sistemático
                scanningActive = false; // Reset para que se configure en nextAction()
                state = State::ScanForBlocks;
            }
            break;
            
        case State::ScanForBlocks:
            // Procesamos el resultado del escaneo actual
            if ((msg.contains("action") && msg["action"] == "block_at") ||
                (msg.contains("type") && msg["type"] == "block_at")) {
                
                if (msg.contains("name")) {
                    std::string blockName = msg["name"];
                    std::cerr << "*** BLOCK FOUND *** at (" << scanX << ", " << scanY << ", " << scanZ << "): " << blockName << std::endl;
                }
                
                // Avanzar a la siguiente posición del escaneo
                scanX++;
                if (scanX > scanEndX) {
                    scanX = scanStartX;
                    scanZ++;
                    if (scanZ > scanEndZ) {
                        scanZ = scanStartZ;
                        scanY++;
                        if (scanY > scanEndY) {
                            // Terminamos el escaneo
                            std::cerr << "Block scan completed. Changing direction and resuming movement." << std::endl;
                            scanningActive = false;
                            changeDirection();
                        }
                    }
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