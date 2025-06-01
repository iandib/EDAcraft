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

#pragma once
#include <nlohmann/json.hpp>

class FSM {
public:
    // Constructor: initializes FSM state and origin
    FSM();

    // Returns the next action to send to the bot as a JSON command
    nlohmann::json nextAction();

    // Processes bot's reply to update FSM state
    void handleBotFeedback(const nlohmann::json& msg);

    // Optionally update the bot's origin position
    void setOrigin(int x, int y, int z);

private:

    // Internal FSM states: modify this code to make your bot acomplish tasks.
    enum class State {
        Idle,
        estado2, // Not doing anything
        RequestPosition,   // Ask the bot for its current position
        MoveToTarget,      // Move to a new target based on origin
        Done               // Task complete
    } state;

    // Origin coordinates (used as base reference)
    int originX, originY, originZ;

    // Contador de pasos para movimiento en línea recta
    int stepCount;

    // Flag para evitar enviar múltiples comandos step sin esperar respuesta
    bool waitingForStepResponse;

    // Optional flag if needed later
    bool moved = false;
};