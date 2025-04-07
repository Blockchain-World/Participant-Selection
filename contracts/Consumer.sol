// Consumer/Market.sol
// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.29;

// Used to maintain all consumer information in the P2P network
contract Consumer {

    struct EvalofConsumer {
        uint256 dl_times;
        uint256 misbehave;
    }
    
    struct ConsumerInfo {
        uint256 cred; // Evaluated reputation value
        EvalofConsumer evaluation_info;
    }


    // Get my evaluation information
    function GetMyMisbehave (address _consumer_address) view public returns (uint256) {
        return consumer_info[_consumer_address].evaluation_info.misbehave;
    }
    // Consumer address to consumer information
    mapping(address => ConsumerInfo) public consumer_info;
    // Consumer address and content hash to content information mapping

    // Get consumer reputation value
    function GetMyCred(address _consumer_address) view public returns (uint256) {
        return consumer_info[_consumer_address].cred;
    }
    
    // Get my evaluation information
    function GetMyEval(address _consumer_address) view public returns (EvalofConsumer memory) {
        return consumer_info[_consumer_address].evaluation_info;
    }

    // Increment consumer download count
    function incrementConsumerStats(address _consumer) public {
        // Ensure the caller is an authorized contract
        // In a production environment, stricter access control should be added
        
        // Get consumer information
        ConsumerInfo storage consumerInfo = consumer_info[_consumer];
        
        // Increment download count
        consumerInfo.evaluation_info.dl_times += 1;
        
        // Additional logic can be added here, such as updating reputation value
    }

    // Method to get consumer evaluation information
    function GetMyConsumerInfo(address _consumer) public view returns (ConsumerInfo memory) {
        return consumer_info[_consumer];
    }

    // Increment Consumer's misbehavior count
    function incrementMisbehave(address _consumer) public {
        // Ensure the caller is an authorized contract
        // In a production environment, stricter access control should be added
        
        // Increment misbehavior count
        consumer_info[_consumer].evaluation_info.misbehave += 1;
        
        // Additional logic can be added here, such as updating reputation value
    }

}   
