// contracts/Market.sol
// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.29;

import "./Content.sol";
// Used to maintain all provider information in the P2P network
contract Provider {

    struct EvalofProvider {
        uint256 provide_times;
        uint256 misbehave;
        uint256 involve_del;
        uint256 content_types;
    }
    
    struct ProviderInfo {
        uint256 cred; // Evaluated reputation value
        EvalofProvider evaluation_info;
        address provider_address;
    }

    // Provider address to provider information
    mapping(address => ProviderInfo) public provider_info;
    
    // Provider address and content hash to content information mapping
    mapping(address => mapping(uint256 => Content.ContentInfo)) public provider_content;
    
    // Provider address to payment amount mapping
    mapping(address => uint256) public payment_PD;
    mapping(address => uint256) public payment_PC;


    // Get provider reputation value
    function GetMyCred(address _provider_address) view public returns (uint256) {
        return provider_info[_provider_address].cred;
    }
    
    // Get my evaluation information
    function GetMyEval(address _provider_address) view public returns (EvalofProvider memory) {
        return provider_info[_provider_address].evaluation_info;
    }

    // Get my evaluation information
    function GetMyMisbehave (address _provider_address) view public returns (uint256) {
        return provider_info[_provider_address].evaluation_info.misbehave;
    }

    // Get my content
    function GetMyContent(address _provider_address , uint256 _contenthash) view public returns (Content.ContentInfo memory) {
        return provider_content[_provider_address][_contenthash];
    }
    
    function setPayment (address _provider_address, uint256 _payment_PD, uint256 _payment_PC) public {
        payment_PD[_provider_address] = _payment_PD;
        payment_PC[_provider_address] = _payment_PC;
    }

    // Add new function to manage provider content
    function addProviderContent(address provider, bytes32 content_hash, uint256 selling_price, string[] memory mata_data) external {
        // Add content information to provider's content mapping
        Content.ContentInfo memory newContent;
        newContent.content_hash = uint256(uint(content_hash)); // If content_hash in ContentInfo is uint256 type
        newContent.selling_price = selling_price;
        newContent.meta_data = mata_data;
        
        // Directly update mapping
        provider_content[provider][uint256(uint(content_hash))] = newContent;
    }

    // Update meta data
    function updateMetaData(address provider, bytes32 content_hash, string memory meta_data) external {
        // Directly update mapping
        provider_content[provider][uint256(uint(content_hash))].meta_data.push(meta_data);
    }

    // Add function to increment provider's content type count
    function incrementContentTypes(address provider) public {
        provider_info[provider].evaluation_info.content_types += 1;
    }
    function getProviderPaymentPC(address provider_addr) public view returns (uint) {
        return payment_PC[provider_addr];
    }

    function getProviderInfo(address provider_addr) public view returns (ProviderInfo memory) {
        return provider_info[provider_addr];
    }

    function getPcan(address provider_addr) public view returns (ProviderInfo[] memory) {
        ProviderInfo[] memory result = new ProviderInfo[](1);
        result[0] = provider_info[provider_addr];
        return result;
    }

    function OPS(ProviderInfo[] memory p_can, uint256 _payment_PC) public view returns (address) {
        // Initialize variables
        address p_sel = address(0);
        
        // Create new array to store sorted providers
        address[] memory sorted_providers = new address[](p_can.length);
        uint[] memory provider_creds = new uint[](p_can.length);
        
        // Copy array - extract addresses and reputation values from p_can
        for (uint i = 0; i < p_can.length; i++) {
            sorted_providers[i] = p_can[i].provider_address; 
            provider_creds[i] = p_can[i].cred; 
        }
        
        // Sort providers by reputation value in descending order (using selection sort instead of bubble sort)
        for (uint i = 0; i < p_can.length; i++) {
            uint maxIndex = i;
            for (uint j = i + 1; j < p_can.length; j++) {
                if (provider_creds[j] > provider_creds[maxIndex]) {
                    maxIndex = j;
                }
            }
            
            if (maxIndex != i) {
                // Swap reputation values
                uint temp_cred = provider_creds[i];
                provider_creds[i] = provider_creds[maxIndex];
                provider_creds[maxIndex] = temp_cred;
                
                // Swap addresses
                address temp_addr = sorted_providers[i];
                sorted_providers[i] = sorted_providers[maxIndex];
                sorted_providers[maxIndex] = temp_addr;
            }
        }
        
        // Traverse sorted provider list
        for (uint i = 0; i < sorted_providers.length; i++) {
            address provider_addr = sorted_providers[i];
            
            // Skip if provider address is zero address
            if (provider_addr == address(0)) {
                continue;
            }
            
            // Get provider price
            uint provider_price = payment_PC[provider_addr];
            
            // If provider price is 0 or less than or equal to consumer's willing payment
            if (provider_price == 0 || provider_price <= _payment_PC) { 
                p_sel = provider_addr;
                break;
            }
        }
        
        return p_sel;
    }

    function GetSelectedProvider(address provider_addr, ProviderInfo memory newInfo) public {
        // Ensure provider_address field is set correctly
        newInfo.provider_address = provider_addr;
        provider_info[provider_addr] = newInfo;
    }

    // Initialize provider information
    function initializeProvider(address provider_addr) public {
        // Check if provider already exists
        if (provider_info[provider_addr].provider_address == address(0)) {
            // Create new provider information
            ProviderInfo memory newInfo = ProviderInfo({
                cred: 101,
                evaluation_info: EvalofProvider({
                    provide_times: 0,
                    misbehave: 0,
                    involve_del: 0,
                    content_types: 0
                }),
                provider_address: provider_addr
            });
            
            // Store provider information
            provider_info[provider_addr] = newInfo;
        }
    }

    // Increment provider's statistics
    function incrementProviderStats(address _provider, uint _delivererCount) public {
        // Ensure the caller is an authorized contract
        // In a production environment, stricter access control should be added
        
        // Get provider information
        ProviderInfo storage provider = provider_info[_provider];
        
        // Increment provide times
        provider.evaluation_info.provide_times += 1;
        
        // Increment involved deliverer count
        provider.evaluation_info.involve_del += _delivererCount;
        
        // Additional logic can be added here, such as updating reputation value
    }

    // Increment Provider's misbehavior count
    function incrementMisbehave(address _provider) public {
        // Ensure the caller is an authorized contract
        // In a production environment, stricter access control should be added
        
        // Increment misbehavior count
        provider_info[_provider].evaluation_info.misbehave += 1;
        
        // Additional logic can be added here, such as updating reputation value
    }
}   
