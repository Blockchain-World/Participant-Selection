// library/Content.sol
// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.29;

contract Content {

    struct ContentInfo {
        uint256 content_hash; // Content hash
        uint256 selling_price; // Selling price
        string[] meta_data; // Metadata
    }

    // Mapping from content hash to provider addresses
    mapping(bytes32 => address[]) public content_hash_to_provider;

    // Function to get provider list by content hash
    function getProvidersByContentHash(bytes32 _content_hash) public view returns (address[] memory) {
        return content_hash_to_provider[_content_hash];
    }

    // Function to add provider to content hash mapping
    function addProviderToContentHash(bytes32 _content_hash, address _provider) public {
        content_hash_to_provider[_content_hash].push(_provider);
    }

}