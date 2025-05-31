/**
 * @brief Handles input and output info
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

void sendToBot(const nlohmann::json& cmd);
nlohmann::json receiveFromBot();