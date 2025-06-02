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
FSM::FSM() : state(State::RequestPosition), originX(0), originY(0), originZ(0) {}

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
            action["action"] = "step";
            action["dir"] = "east";
            std::cerr << "Sending step east..." << std::endl;
            return action;
            
        case State::Idle:
            // En estado idle, no hacemos nada por ahora
            return nlohmann::json{}; // Retorna JSON vacío
            
        case State::Done:
            std::cerr << "Task completed!" << std::endl;
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
            // Si recibimos la posición correctamente, cambiamos a MoveToTarget
            if ((msg.contains("status") && msg["status"] == "ok") || 
                (msg.contains("type") && msg["type"] == "position")) {
                std::cerr << "Position received, starting movement..." << std::endl;
                state = State::MoveToTarget;
            }
            break;
            
        case State::MoveToTarget:
            // Si el paso fue exitoso, seguimos moviéndonos
            if (msg.contains("action") && msg["action"] == "step") {
                if (msg.contains("ok") && msg["ok"] == true) {
                    std::cerr << "Step successful, continuing movement..." << std::endl;
                    // Mantenemos el estado MoveToTarget para seguir moviéndonos
                } else {
                    std::cerr << "Step failed: " << msg.dump() << std::endl;
                    state = State::Idle; // Vamos a idle si falla el movimiento
                }
            }
            break;
            
        default:
            break;
    }
}

// Optionally update the bot's origin position
void FSM::setOrigin(int x, int y, int z) {
    originX = x;
    originY = y;
    originZ = z;
}