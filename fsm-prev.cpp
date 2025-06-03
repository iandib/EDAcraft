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

bool anotherStep = true;

// Generate the next action command based on the current FSM state
nlohmann::json FSM::nextAction()
{
    if (anotherStep)
    {
        nlohmann::json action;
        action["action"] = "step";
        action["dir"] = "east";

        std::cerr << "Sending step north..." << std::endl;
        anotherStep = false;

        return action;
    }

    return NULL;
}

// Process the bot's reply to transition FSM state
void FSM::handleBotFeedback(const nlohmann::json& msg)
{
    if (!msg.contains("action")) return;

    if (msg["action"] == "step" && msg["ok"] == true)
    {
        std::cerr << "Do another step." << std::endl;
        anotherStep = true;
    }

}