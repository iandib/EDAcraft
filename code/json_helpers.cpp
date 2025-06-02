/**
 * @brief Json helper functions that build the commands used by the bot
 *
 * @author Agustín Galdeman
 * @author Ian A. Dib
 * @author Luciano S. Cordero
 *
 * @copyright Copyright (c) 2025
 *
 */

#include "json_helpers.h"
#include <cmath>

nlohmann::json createPositionCommand()
{
    return nlohmann::json{{"action", "position"}};
}

nlohmann::json createBlockAtCommand(int x, int y, int z)
{
    // According to the documentation, block_at uses this format
    return nlohmann::json{
        {"action", "block_at"},
        {"position", {
            {"x", x},
            {"y", y},
            {"z", z}
        }}
    };
}

nlohmann::json createStepCommand(const std::string& direction)
{
    return nlohmann::json{
        {"action", "step"},
        {"dir", direction}
    };
}

nlohmann::json createJumpCommand()
{
    return nlohmann::json{{"action", "jump"}};
}

bool isSuccessResponse(const nlohmann::json& response)
{
    // Check for explicit success indicator
    if (response.contains("status") && response["status"] == "ok") {
        return true;
    }
    
    // Check for ok field (both boolean and string formats)
    if (response.contains("ok")) {
        if (response["ok"].is_boolean()) {
            return response["ok"].get<bool>();
        } else if (response["ok"].is_string()) {
            return response["ok"] == "true";
        }
    }
    
    // Check if there's no error and no explicit failure
    if (!response.contains("error") && !response.contains("message")) {
        return true;
    }
    
    return false;
}

bool extractPosition(const nlohmann::json& response, int& x, int& y, int& z)
{
    try {
        // Check for position object format
        if (response.contains("position")) {
            const auto& pos = response["position"];
            if (pos.contains("x") && pos.contains("y") && pos.contains("z")) {
                x = static_cast<int>(std::round(pos["x"].get<double>()));
                y = static_cast<int>(std::round(pos["y"].get<double>()));
                z = static_cast<int>(std::round(pos["z"].get<double>()));
                return true;
            }
        }
        
        // Alternative format: direct x, y, z fields
        if (response.contains("x") && response.contains("y") && response.contains("z")) {
            x = static_cast<int>(std::round(response["x"].get<double>()));
            y = static_cast<int>(std::round(response["y"].get<double>()));
            z = static_cast<int>(std::round(response["z"].get<double>()));
            return true;
        }
        
    } catch (const std::exception& e) {
        return false;
    }
    
    return false;
}

bool extractBlockInfo(const nlohmann::json& response, std::string& blockName)
{
    try {
        if (response.contains("name")) {
            blockName = response["name"].get<std::string>();
            return true;
        }
        
        // Check if it's a "no block found" response
        if (response.contains("message")) {
            std::string message = response["message"].get<std::string>();
            if (message == "No block found") {
                blockName = "air";
                return true;
            }
        }
        
    } catch (const std::exception& e) {
        return false;
    }
    
    return false;
}