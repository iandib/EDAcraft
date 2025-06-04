/**
 * @brief FSM that handles bot behaviour with A* pathfinding
 *
 * @author Agustín Galdeman
 * @author Enhanced with A* pathfinding
 *
 * @copyright Copyright (c) 2025
 *
 */

#include "fsm.h"
#include <iostream>

// Constructor: set initial state and initialize pathfinder
FSM::FSM() : state(State::Idle), originX(0), originY(0), originZ(0), 
             hasTarget(false), totalSteps(0) {
    // Establecer automáticamente las coordenadas objetivo
    setTarget(-791, 103, 152);
    std::cerr << "FSM initialized with automatic target: (-791, 103, 152)" << std::endl;
}

// Generate the next action command based on the current FSM state
nlohmann::json FSM::nextAction()
{
    switch (state) {
        case State::Idle:
            if (hasTarget) {
                std::cerr << "Starting A* pathfinding to target..." << std::endl;
                state = State::Pathfinding;
                return pathfinder.nextAction();
            }
            std::cerr << "FSM is idle, no target set..." << std::endl;
            return nlohmann::json{};
            
        case State::Pathfinding:
            // Delegate to A* pathfinder
            if (pathfinder.isComplete()) {
                std::cerr << "A* Pathfinding completed!" << std::endl;
                state = State::Done;
                return nlohmann::json{};
            }
            return pathfinder.nextAction();
            
        case State::Done:
            std::cerr << "FSM task completed!" << std::endl;
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
        case State::Idle:
            // Nothing to handle in idle state
            break;
            
        case State::Pathfinding:
            // Delegate feedback handling to pathfinder
            pathfinder.handleBotFeedback(msg);
            
            // Count successful steps for statistics
            if (msg.contains("action") && msg["action"] == "step" && msg.contains("ok")) {
                bool stepSuccessful = false;
                if (msg["ok"].is_boolean()) {
                    stepSuccessful = msg["ok"].get<bool>();
                } else if (msg["ok"].is_string()) {
                    stepSuccessful = (msg["ok"] == "true");
                }
                if (stepSuccessful) {
                    totalSteps++;
                }
            }
            
            // Check if pathfinding is complete
            if (pathfinder.isComplete()) {
                std::cerr << "Pathfinding completed after " << totalSteps << " total steps." << std::endl;
                state = State::Done;
            }
            break;
            
        case State::Done:
            // Task is complete, ignore further feedback
            break;
            
        default:
            break;
    }
}

// Set target destination for A* pathfinding
void FSM::setTarget(int x, int y, int z) {
    target = Position3D(x, y, z);
    hasTarget = true;
    totalSteps = 0;
    
    // Configure pathfinder with target
    pathfinder.setTarget(x, y, z);
    
    std::cerr << "FSM target set to (" << x << ", " << y << ", " << z << ") - A* pathfinding will be used" << std::endl;
    
    if (state == State::Idle) {
        state = State::Pathfinding;
    }
}

void FSM::setTarget(const Position3D& targetPos) {
    setTarget(targetPos.x, targetPos.y, targetPos.z);
}

// Check if the bot has completed its task
bool FSM::isComplete() const {
    return state == State::Done;
}

// Optionally update the bot's origin position
void FSM::setOrigin(int x, int y, int z) {
    originX = x;
    originY = y;
    originZ = z;
    std::cerr << "FSM origin set to (" << x << ", " << y << ", " << z << ")" << std::endl;
}