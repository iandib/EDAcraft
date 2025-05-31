/**
 * @brief Main file
 *
 * @author Agustín Galdeman
 * @author
 * @author
 *
 * @copyright Copyright (c) 2025
 *
 */

#include <iostream>
#include <chrono>
#include <thread>
#include "fsm.h"
#include "bot_io.h"

int main() {
    // Create the FSM instance (handles task logic and state)
    FSM fsm;

    std::cerr << "[C++] Starting FSM loop...\n";

    // Main control loop — runs indefinitely until an error occurs or task ends
    while (true) {
        // Small delay to avoid flooding the JS process
        std::this_thread::sleep_for(std::chrono::milliseconds(100));

        // Ask the FSM what the next action is (e.g., move, get position, etc.)
        nlohmann::json cmd = fsm.nextAction();

        // If FSM has nothing to do right now, skip this cycle
        if (cmd.is_null()) continue;

        // Log the outgoing command
        std::cerr << "[C++] Sending: " << cmd.dump() << "\n";

        try {
            // Send the JSON command to the JS bot via stdout
            sendToBot(cmd);

            // Wait and receive a JSON reply from the bot via stdin
            auto reply = receiveFromBot();

            // Log the reply we got from JS
            std::cerr << "[C++] Received: " << reply.dump() << "\n";

            // Pass the reply to the FSM so it can update its state
            fsm.handleBotFeedback(reply);
        } catch (const std::exception& e) {
            // If something goes wrong (no reply, invalid JSON), log and stop
            std::cerr << "[C++] Communication error: " << e.what() << "\n";
            break;
        }
    }

    return 0;
}