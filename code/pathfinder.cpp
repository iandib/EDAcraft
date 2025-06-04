/**
 * @brief A* pathfinder implementation for bot navigation
 * @author Based on FSM by Agustín Galdeman
 */

#include "pathfinder.h"
#include <iostream>
#include <cmath>
#include <algorithm>
#include <limits>

PathFinder::PathFinder() : state(State::Idle), 
                          currentX(0), currentY(0), currentZ(0),
                          hasTarget(false), currentDirection("east"), 
                          obstacleCheckCount(0), stepCount(0), 
                          currentDirectionIndex(0), currentPathIndex(0),
                          needsReplan(false) {
    // Define possible movement directions
    directions = {"east", "south", "west", "north"};
}

void PathFinder::setTarget(const Position3D& targetPos) {
    setTarget(targetPos.x, targetPos.y, targetPos.z);
}

void PathFinder::setTarget(int x, int y, int z) {
    target = Position3D(x, y, z);
    hasTarget = true;
    stepCount = 0;
    currentPath.clear();
    currentPathIndex = 0;
    needsReplan = true;
    
    if (state == State::Idle) {
        state = State::RequestPosition;
        std::cerr << "A* Target set to (" << x << ", " << y << ", " << z << ")" << std::endl;
    }
}

bool PathFinder::isComplete() const {
    return state == State::Done || state == State::Idle;
}

nlohmann::json PathFinder::nextAction() {
    nlohmann::json action;
    
    if (!hasTarget) {
        std::cerr << "No target set, staying idle..." << std::endl;
        return nlohmann::json{};
    }
    
    switch (state) {
        case State::RequestPosition:
            action["action"] = "position";
            std::cerr << "Requesting bot position for A* pathfinding..." << std::endl;
            return action;
            
        case State::RequestCurrentPosition:
            action["action"] = "position";
            std::cerr << "Requesting updated position after obstacle..." << std::endl;
            return action;
            
        case State::MoveToTarget:
            // Check if we've reached the target
            if (isAtTarget()) {
                std::cerr << "Target reached! Completed in " << stepCount << " steps." << std::endl;
                state = State::Done;
                return nlohmann::json{};
            }
            
            // Limit steps to avoid infinite loops
            if (stepCount >= MAX_STEPS) {
                std::cerr << "Maximum steps reached, pathfinding failed." << std::endl;
                state = State::Done;
                return nlohmann::json{};
            }
            
            // Replan if needed or if we don't have a path
            if (needsReplan || currentPath.empty() || currentPathIndex >= currentPath.size()) {
                planPath();
                if (currentPath.empty()) {
                    std::cerr << "No path found to target!" << std::endl;
                    state = State::Done;
                    return nlohmann::json{};
                }
            }
            
            // Check if we've reached current waypoint
            if (isAtCurrentWaypoint() && currentPathIndex < currentPath.size() - 1) {
                currentPathIndex++;
                std::cerr << "Reached waypoint " << currentPathIndex << "/" << currentPath.size() << std::endl;
            }
            
            action["action"] = "step";
            action["dir"] = currentDirection;
            std::cerr << "A* Step " << currentDirection << " towards waypoint " << currentPathIndex 
                      << " (step " << stepCount + 1 << ")" << std::endl;
            return action;
            
        case State::CheckObstacle:
            // Check the two blocks in front (ground level and head level)
            int checkX, checkY, checkZ;
            getFrontBlockPosition(checkX, checkY, checkZ, obstacleCheckCount == 1);
            
            action["action"] = "block_at";
            action["position"]["x"] = checkX;
            action["position"]["y"] = checkY;
            action["position"]["z"] = checkZ;
            
            std::cerr << "Checking obstacle block " << (obstacleCheckCount + 1) << "/2 at (" 
                      << checkX << ", " << checkY << ", " << checkZ << ")" << std::endl;
            return action;
            
        case State::Idle:
        case State::Done:
            return nlohmann::json{};
            
        default:
            return nlohmann::json{};
    }
}

void PathFinder::handleBotFeedback(const nlohmann::json& msg) {
    if (!msg.contains("action") && !msg.contains("status") && !msg.contains("type")) {
        return;
    }

    switch (state) {
        case State::RequestPosition:
        case State::RequestCurrentPosition:
            // Handle position response
            if ((msg.contains("status") && msg["status"] == "ok") || 
                (msg.contains("type") && msg["type"] == "position")) {
                
                if (msg.contains("position")) {
                    currentX = msg["position"]["x"];
                    currentY = msg["position"]["y"];
                    currentZ = msg["position"]["z"];
                } else if (msg.contains("x") && msg.contains("y") && msg.contains("z")) {
                    currentX = msg["x"];
                    currentY = msg["y"];
                    currentZ = msg["z"];
                }
                
                std::cerr << "Position: (" << currentX << ", " << currentY << ", " << currentZ << ")" << std::endl;
                std::cerr << "Distance to target: " << getDistanceToTarget() << std::endl;
                
                if (state == State::RequestPosition) {
                    // Plan initial path
                    planPath();
                    state = State::MoveToTarget;
                } else {
                    // After obstacle detection, start checking blocks
                    obstacleCheckCount = 0;
                    state = State::CheckObstacle;
                }
            }
            break;
            
        case State::MoveToTarget:
            if (msg.contains("action") && msg["action"] == "step") {
                bool stepSuccessful = false;
                if (msg.contains("ok")) {
                    if (msg["ok"].is_boolean()) {
                        stepSuccessful = msg["ok"].get<bool>();
                    } else if (msg["ok"].is_string()) {
                        stepSuccessful = (msg["ok"] == "true");
                    }
                }
                
                if (stepSuccessful) {
                    stepCount++;
                    
                    // Update position based on movement direction
                    if (currentDirection == "east") {
                        currentX++;
                    } else if (currentDirection == "west") {
                        currentX--;
                    } else if (currentDirection == "north") {
                        currentZ--;
                    } else if (currentDirection == "south") {
                        currentZ++;
                    }
                    
                    std::cerr << "New position: (" << currentX << ", " << currentY << ", " << currentZ << ")" << std::endl;
                    std::cerr << "Distance to target: " << getDistanceToTarget() << std::endl;
                    
                    // Update direction towards next waypoint
                    chooseNextDirection();
                    
                } else {
                    std::cerr << "Step failed, checking obstacles..." << std::endl;
                    state = State::RequestCurrentPosition;
                }
            }
            break;
            
        case State::CheckObstacle:
            if ((msg.contains("action") && msg["action"] == "block_at") ||
                (msg.contains("type") && msg["type"] == "block_at")) {
                
                if (msg.contains("name")) {
                    std::string blockName = msg["name"];
                    int checkX, checkY, checkZ;
                    getFrontBlockPosition(checkX, checkY, checkZ, obstacleCheckCount == 1);
                    std::cerr << "*** OBSTACLE FOUND *** at (" << checkX << ", " << checkY << ", " << checkZ << "): " << blockName << std::endl;
                    
                    // Add obstacle to known obstacles and mark for replan
                    addObstacle(Position3D(checkX, checkY, checkZ));
                    needsReplan = true;
                }
                
                obstacleCheckCount++;
                if (obstacleCheckCount >= 2) {
                    // Finished checking both blocks, replan and continue
                    std::cerr << "Obstacle check completed. Replanning path..." << std::endl;
                    planPath();
                    state = State::MoveToTarget;
                }
            }
            break;
            
        default:
            break;
    }
}

void PathFinder::planPath() {
    if (!hasTarget) return;
    
    Position3D start(currentX, currentY, currentZ);
    currentPath = findPath(start, target);
    currentPathIndex = 0;
    needsReplan = false;
    
    if (!currentPath.empty()) {
        std::cerr << "A* path planned with " << currentPath.size() << " waypoints" << std::endl;
        chooseNextDirection();
    } else {
        std::cerr << "A* failed to find path!" << std::endl;
    }
}

std::vector<Position3D> PathFinder::findPath(const Position3D& start, const Position3D& goal) {
    std::priority_queue<AStarNode, std::vector<AStarNode>, std::greater<AStarNode>> openSet;
    std::unordered_map<Position3D, AStarNode, Position3DHash> allNodes;
    std::unordered_set<Position3D, Position3DHash> closedSet;
    
    // Initialize start node
    AStarNode startNode(start);
    startNode.gCost = 0;
    startNode.hCost = calculateHeuristic(start, goal);
    startNode.fCost = startNode.gCost + startNode.hCost;
    
    openSet.push(startNode);
    allNodes[start] = startNode;
    
    int nodesExplored = 0;
    const int MAX_NODES = 10000; // Limit search to prevent infinite loops
    
    while (!openSet.empty() && nodesExplored < MAX_NODES) {
        AStarNode current = openSet.top();
        openSet.pop();
        nodesExplored++;
        
        if (closedSet.find(current.position) != closedSet.end()) {
            continue; // Already processed
        }
        
        closedSet.insert(current.position);
        
        // Check if we reached the goal
        if (current.position == goal || 
            (abs(current.position.x - goal.x) <= 2 && abs(current.position.z - goal.z) <= 2)) {
            std::cerr << "A* path found! Explored " << nodesExplored << " nodes." << std::endl;
            return reconstructPath(allNodes, current.position); // CORREGIDO: solo pasamos allNodes y goal
        }
        
        // Explore neighbors
        std::vector<Position3D> neighbors = getNeighbors(current.position);
        for (const Position3D& neighbor : neighbors) {
            if (closedSet.find(neighbor) != closedSet.end()) {
                continue; // Already processed
            }
            
            if (!isValidPosition(neighbor)) {
                continue; // Invalid position
            }
            
            int tentativeGCost = current.gCost + 1;
            
            bool isNewNode = (allNodes.find(neighbor) == allNodes.end());
            if (isNewNode || tentativeGCost < allNodes[neighbor].gCost) {
                AStarNode neighborNode(neighbor);
                neighborNode.gCost = tentativeGCost;
                neighborNode.hCost = calculateHeuristic(neighbor, goal);
                neighborNode.fCost = neighborNode.gCost + neighborNode.hCost;
                neighborNode.parent = current.position; // Establecer padre
                neighborNode.hasParent = true;
                
                allNodes[neighbor] = neighborNode;
                openSet.push(neighborNode);
            }
        }
    }
    
    std::cerr << "A* failed to find path after exploring " << nodesExplored << " nodes." << std::endl;
    return std::vector<Position3D>(); // Empty path
}

int PathFinder::calculateHeuristic(const Position3D& from, const Position3D& to) {
    // Manhattan distance (more accurate for Minecraft movement)
    return abs(from.x - to.x) + abs(from.z - to.z);
}

std::vector<Position3D> PathFinder::getNeighbors(const Position3D& pos) {
    std::vector<Position3D> neighbors;
    
    // Four cardinal directions on the same Y level
    neighbors.push_back(Position3D(pos.x + 1, pos.y, pos.z)); // East
    neighbors.push_back(Position3D(pos.x - 1, pos.y, pos.z)); // West
    neighbors.push_back(Position3D(pos.x, pos.y, pos.z + 1)); // South
    neighbors.push_back(Position3D(pos.x, pos.y, pos.z - 1)); // North
    
    return neighbors;
}

std::vector<Position3D> PathFinder::reconstructPath(const std::unordered_map<Position3D, AStarNode, Position3DHash>& allNodes, 
                                                   const Position3D& goal) {
    std::vector<Position3D> path;
    Position3D current = goal;
    
    // Reconstruct path by following parent pointers
    while (true) {
        path.push_back(current);
        
        auto nodeIt = allNodes.find(current);
        if (nodeIt == allNodes.end() || !nodeIt->second.hasParent) {
            break; // Reached start node or invalid node
        }
        
        current = nodeIt->second.parent;
    }
    
    std::reverse(path.begin(), path.end());
    return path;
}

bool PathFinder::isValidPosition(const Position3D& pos) {
    // Check if position is a known obstacle
    if (knownObstacles.find(pos) != knownObstacles.end()) {
        return false;
    }
    
    // For now, assume all positions are valid unless we know they're obstacles
    // In a more sophisticated implementation, we might have terrain data
    return true;
}

void PathFinder::chooseNextDirection() {
    if (currentPath.empty() || currentPathIndex >= currentPath.size()) {
        return;
    }
    
    std::string newDirection = calculateDirectionToNextWaypoint();
    if (!newDirection.empty()) {
        currentDirection = newDirection;
        // Update currentDirectionIndex to match
        for (int i = 0; i < directions.size(); i++) {
            if (directions[i] == currentDirection) {
                currentDirectionIndex = i;
                break;
            }
        }
        std::cerr << "A* choosing direction " << currentDirection << " towards waypoint " << currentPathIndex << std::endl;
    }
}

std::string PathFinder::calculateDirectionToNextWaypoint() {
    if (currentPath.empty() || currentPathIndex >= currentPath.size()) {
        return "east"; // Default
    }
    
    Position3D nextWaypoint = currentPath[currentPathIndex];
    int dx = nextWaypoint.x - currentX;
    int dz = nextWaypoint.z - currentZ;
    
    // Choose direction based on largest difference
    if (abs(dx) > abs(dz)) {
        return (dx > 0) ? "east" : "west";
    } else if (abs(dz) > 0) {
        return (dz > 0) ? "south" : "north";
    }
    
    return "east"; // Default direction
}

void PathFinder::changeDirection() {
    // This is now handled by A* replanning
    needsReplan = true;
}

bool PathFinder::isAtTarget() const {
    // Consider we're at target if we're within 2 blocks distance
    int dx = abs(target.x - currentX);
    int dz = abs(target.z - currentZ);
    return dx <= 2 && dz <= 2;
}

bool PathFinder::isAtCurrentWaypoint() const {
    if (currentPath.empty() || currentPathIndex >= currentPath.size()) {
        return false;
    }
    
    Position3D waypoint = currentPath[currentPathIndex];
    return currentX == waypoint.x && currentZ == waypoint.z;
}

void PathFinder::getFrontBlockPosition(int& x, int& y, int& z, bool upperBlock) {
    x = currentX;
    y = currentY + (upperBlock ? 1 : 0);
    z = currentZ;
    
    // Adjust coordinates based on direction
    if (currentDirection == "east") {
        x++;
    } else if (currentDirection == "west") {
        x--;
    } else if (currentDirection == "north") {
        z--;
    } else if (currentDirection == "south") {
        z++;
    }
}

int PathFinder::getDistanceToTarget() const {
    return abs(target.x - currentX) + abs(target.z - currentZ);
}

void PathFinder::addObstacle(const Position3D& pos) {
    knownObstacles.insert(pos);
    std::cerr << "Added obstacle at (" << pos.x << ", " << pos.y << ", " << pos.z << ")" << std::endl;
}