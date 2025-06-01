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

// Constructor: set initial state and origin
FSM::FSM() : state(State::RequestPosition), originX(0), originY(0), originZ(0), stepCount(0), waitingForStepResponse(false) {}

// Save the bot's initial position
void FSM::setOrigin(int x, int y, int z)
{
    originX = x;
    originY = y;
    originZ = z;
}

// Generate the next action command based on the current FSM state
nlohmann::json FSM::nextAction()
{
    switch (state)
    {
        case State::RequestPosition:
            return { {"action", "position"} };

        case State::MoveToTarget:
            // Solo enviar siguiente paso si no estamos esperando respuesta
            if (!waitingForStepResponse && stepCount < 100) {
                waitingForStepResponse = true; // Marcar que esperamos respuesta
                return {
                    {"action", "step"},
                    {"dir", "north"}
                };
            } else if (stepCount >= 100) {
                // Ya completamos los 5 pasos
                state = State::Done;
                return nlohmann::json(nullptr);
            } else {
                // Esperando respuesta del paso anterior
                return nlohmann::json(nullptr);
            }

        case State::Done:
        case State::Idle:
        default:
            return nlohmann::json(nullptr);  // No action
    }
}

// Process the bot's reply to transition FSM state
void FSM::handleBotFeedback(const nlohmann::json& msg)
{
    // Manejar respuesta de posición
    if (state == State::RequestPosition && msg.contains("type") && msg["type"] == "position")
    {
        if (msg.contains("x") && msg.contains("y") && msg.contains("z")) {
            setOrigin(msg["x"], msg["y"], msg["z"]);
            state = State::MoveToTarget;
            stepCount = 0; // Resetear contador de pasos
        }
    }
    // Manejar respuesta de movimiento (step)
    else if (state == State::MoveToTarget && msg.contains("action") && msg["action"] == "step")
    {
        waitingForStepResponse = false; // Ya no esperamos respuesta
        
        if (msg.contains("ok") && msg["ok"] == true) {
            // Paso exitoso, incrementar contador
            stepCount++;
            // El estado se mantiene en MoveToTarget hasta completar todos los pasos
        } else {
            // Error en el movimiento, ir a Done
            state = State::Done;
        }
    }
}