// contracts/Deliverer.sol
// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.29;

// Used to maintain all deliverer information in the P2P network
contract Deliverer {

    struct EvalofDeliverer {
        uint256 delivery_nums;    // Number of services provided
        uint256 total_amount;     // Total amount
        uint256 avg_speed;        // Average speed
    }
    
    struct DelivererInfo {
        uint256 cred;             // Evaluated reputation value
        EvalofDeliverer evaluation_info;
    }

    // Deliverer address to deliverer information
    mapping(address => DelivererInfo) public deliverer_info;
    // List of deliverer addresses
    address[] public deliverer_address;

    // Add mainContract variable
    address public mainContract;

    // Get deliverer reputation value
    function GetMyCred(address _deliverer_address) view public returns (uint256) {
        return deliverer_info[_deliverer_address].cred;
    }
    
    // Get my evaluation information
    function GetMyEval(address _deliverer_address) view public returns (EvalofDeliverer memory) {
        return deliverer_info[_deliverer_address].evaluation_info;
    }

    // Initialize deliverer information
    function newDeliverer(address _deliverer_address) public {
        deliverer_address.push(_deliverer_address);
        deliverer_info[_deliverer_address].cred = 100;
        deliverer_info[_deliverer_address].evaluation_info.delivery_nums = 0;
        deliverer_info[_deliverer_address].evaluation_info.total_amount = 0;
        deliverer_info[_deliverer_address].evaluation_info.avg_speed = 0;
    }

    // Get deliverer address list
    function getDelivererAddress() public view returns (address[] memory) {
        return deliverer_address;
    }

    // Set Main contract address
    function setMainContract(address _mainContract) public {
        // Permission control can be added here, for example only allowing contract deployer to set
        mainContract = _mainContract;
    }

    // Update deliverer information
    function updateDelivererInfo(address _deliverer_address, uint _delivery_nums, uint _total_amount, uint _avg_speed) public {
        // Update deliverer's evaluation information
        deliverer_info[_deliverer_address].evaluation_info.delivery_nums += _delivery_nums;
        deliverer_info[_deliverer_address].evaluation_info.total_amount += _total_amount;
        deliverer_info[_deliverer_address].evaluation_info.avg_speed += _avg_speed;
    }

    // Update deliverer statistics
    function updateDelivererStats(
        address deliverer, 
        uint omega, 
        uint chunkLength,
        uint startTime,
        uint endTime
    ) public {
        // Calculate the amount of data delivered this time
        uint amount = omega * chunkLength;
        
        // Calculate the speed of this delivery
        uint duration = endTime - startTime;
        require(duration > 0, "duration must be greater than 0");
        uint speed = amount / duration;
        
        // Update deliverer's statistics
        deliverer_info[deliverer].evaluation_info.delivery_nums += 1;  // Increment delivery count
        deliverer_info[deliverer].evaluation_info.total_amount += amount;  // Increment total amount
        deliverer_info[deliverer].evaluation_info.avg_speed = speed;  // Update average speed
    }
}   