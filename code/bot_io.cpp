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

#include "bot_io.h"
#include <iostream>
#include <string>
#include <stdexcept>

void sendToBot(const nlohmann::json& cmd)
{
    std::cout << cmd.dump() << std::endl;
}

nlohmann::json receiveFromBot()
{
    std::string line;
    if (!std::getline(std::cin, line))
    {
        throw std::runtime_error("No response from JS bot.");
    }
    return nlohmann::json::parse(line);
}