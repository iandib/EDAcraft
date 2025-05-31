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
FSM::FSM() : state(State::RequestPosition), originX(0), originY(0), originZ(0) {}

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
            return
            {
                    {"action", "move"},
                    {"x", originX + 3},
                    {"y", originY},
                    {"z", originZ + 3}
            };

        default:
            return nullptr;  // No action in Idle or Done state
    }
}

// Process the bot's reply to transition FSM state
void FSM::handleBotFeedback(const nlohmann::json& msg)
{
    if (!msg.contains("status")) return;

    if (state == State::RequestPosition && msg["type"] == "position")
    {
        setOrigin(msg["x"], msg["y"], msg["z"]);
        state = State::MoveToTarget;

    }
    else if (state == State::MoveToTarget && msg["status"] == "done")
    {
        state = State::Done;
    }
}